const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { startServer } = require("./backend/api");

const SHM_PATH = path.join(os.tmpdir(), "openclaw_avatar.raw");
const WIDTH = 1280;
const HEIGHT = 720;
const HEADER_SIZE = 20; // Magic(4)+W(4)+H(4)+Time(8)
const FRAME_SIZE = WIDTH * HEIGHT * 4;
const TOTAL_SIZE = HEADER_SIZE + FRAME_SIZE;
const MAGIC = 0x0ca7ca7;

let mainWindow;
let shmFd = null;

function createWindow(isHeadlessGen = false) {
  mainWindow = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    useContentSize: true, // Ensure web content is exactly 720p
    show: false, // Start hidden, or true for debug
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For MVP ease of use with Three.js/fs
      backgroundThrottling: false, // Keep running when hidden
    },
  });

  mainWindow.loadFile("index.html");

  // Once ready, show if you want debugging, BUT only if not headless gen
  mainWindow.once("ready-to-show", () => {
    if (!isHeadlessGen) mainWindow.show();
  });
}

function initSharedMemory() {
  try {
    // Open or Create
    shmFd = fs.openSync(SHM_PATH, "w+");
    // Truncate to ensure size
    fs.ftruncateSync(shmFd, TOTAL_SIZE);

    // Write Header Initial
    const header = Buffer.alloc(HEADER_SIZE);
    header.writeInt32LE(MAGIC, 0);
    header.writeInt32LE(WIDTH, 4);
    header.writeInt32LE(HEIGHT, 8);
    fs.writeSync(shmFd, header, 0, HEADER_SIZE, 0);

    console.log(`[Main] Shared Memory initialized at ${SHM_PATH}`);
  } catch (e) {
    console.error(`[Main] SHM Init Error:`, e);
  }
}

app.whenReady().then(() => {
  // Parse CLI Args
  const args = process.argv;
  const isHeadlessGen = args.includes('--generate-video');
  
  initSharedMemory();
  
  // Only start API server if NOT in headless gen mode (optional, but cleaner)
  // Actually, let's keep it running just in case, or disable it.
  if (!isHeadlessGen) {
      startServer();
  } else {
      console.log('[Main] Running in Standalone Video Generation Mode');
  }

  createWindow(isHeadlessGen);

  if (isHeadlessGen) {
      // Parse gen args
      const audioArgIdx = args.indexOf('--audio');
      const outputArgIdx = args.indexOf('--output');
      const avatarArgIdx = args.indexOf('--avatar');
      const bgImageArgIdx = args.indexOf('--bg-image');
      const bgColorArgIdx = args.indexOf('--bg-color');

      const audioPath = audioArgIdx !== -1 ? args[audioArgIdx + 1] : null;
      const outputPath = outputArgIdx !== -1 ? args[outputArgIdx + 1] : null;
      const avatarPath = avatarArgIdx !== -1 ? args[avatarArgIdx + 1] : null;
      
      let background = null;
      if (bgImageArgIdx !== -1) background = { path: args[bgImageArgIdx + 1] };
      else if (bgColorArgIdx !== -1) background = { color: args[bgColorArgIdx + 1] };

      if (!audioPath || !outputPath) {
          console.error('[Main] Error: --audio and --output are required for generation.');
          app.quit();
          return;
      }

      // Read audio file
      try {
          const audioBuf = fs.readFileSync(audioPath);
          const audioBase64 = audioBuf.toString('base64');
          
          mainWindow.webContents.once('did-finish-load', () => {
             // Delay slightly to ensure renderer is fully ready (Three.js init)
             setTimeout(() => {
                 console.log(`[Main] Sending generation request for ${outputPath}`);
                 mainWindow.webContents.send('generate-video-direct', {
                     audio_data: audioBase64,
                     output_path: path.resolve(outputPath),
                     avatar: avatarPath ? path.resolve(avatarPath) : undefined,
                     background
                 });
             }, 3000); // 3s wait for scene init
          });
      } catch (e) {
          console.error('[Main] Failed to read audio file:', e);
          app.quit();
      }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.on("generation-done", (event, { success, path }) => {
    if (success) {
        console.log(`[Main] Generation Complete: ${path}`);
    } else {
        console.error(`[Main] Generation Failed`);
    }
    app.quit();
});

app.on("window-all-closed", () => {
  if (shmFd) fs.closeSync(shmFd);
  if (process.platform !== "darwin") app.quit();
});

// IPC Handler for Frame Data
// Note: Sending large buffers over IPC can be slow.
// A better production approach involves shared buffers or hidden window readPixels.
// For this MVP, let's try pushing the buffer from Renderer -> Main.
ipcMain.on("frame-data", (event, { buffer, timestamp }) => {
  if (!shmFd) return;

  try {
    // 1. Update timestamp in header
    const timeBuf = Buffer.alloc(8);
    timeBuf.writeBigInt64LE(BigInt(timestamp), 0);
    fs.writeSync(shmFd, timeBuf, 0, 8, 12);

    // 2. Write pixel data
    // Buffer from renderer is usually a Uint8Array (Node Buffer compatible)
    fs.writeSync(shmFd, buffer, 0, buffer.length, HEADER_SIZE);
  } catch (e) {
    console.error("Write error:", e);
  }
});

ipcMain.on("log-message", (event, { level, message }) => {
  console.log(`[Renderer ${level}]`, ...message);
});
