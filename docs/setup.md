# OpenClaw AvatarCam Setup Guide

## 1. Prerequisites

- **Node.js v18 or newer**
- **BlackHole** (Virtual Audio Driver)
  - Install via Homebrew: `brew install blackhole-2ch`
- **Xcode** (for DAL Plugin)

## 2. Electron Avatar Renderer Setup

1. Navigate to `src`:
   ```bash
   cd src
   npm install
   ```
2. **Start the App**:
   ```bash
   npm start
   ```
   This does two things:
   - Launches the **Electron Window** (Avatar Renderer).
   - Starts the **API Server** on `http://127.0.0.1:8000`.

3. **Models & Animation**:
   - Place your VRM model in the `models` directory (e.g., `models/my_avatar.vrm`). The app auto-loads the first one found.
   - Place a VRM Animation (`.vrma`) in the `models` directory (e.g., `models/idle.vrma`). The app auto-plays the first one found.

4. **Shared Memory**:
   The Electron app automatically creates `/tmp/openclaw_avatar_shm` on start. This is where frame data is written for the macOS Virtual Camera plugin.

## 3. API Usage

The application exposes a local API for controlling the avatar.

- **Endpoint**: `http://localhost:8000`
- **Supported Commands**:

  - **Speak (Lip Sync)**:
    - URL: `POST /speak`
    - Body: `{"type": "speak", "data": "BASE64_PCM16_AUDIO"}`
    - Behavior: Plays audio and handles lip-sync.

  - **Reaction**:
    - URL: `POST /reaction`
    - Body: `{"type": "reaction", "name": "smile"}`
    - Supported names: *smile, joy, angry, sorrow, fun* (Mapped to VRM presets).

  - **Change Avatar**:
    - URL: `POST /set_avatar`
    - Body: `{"path": "/absolute/path/to/another_model.vrm"}`

  - **Set Background**:
    - URL: `POST /set_background`
    - Body: `{"color": "#FF0000"}` or `{"path": "/abs/path/to/image.jpg"}`

## 4. Audio & WebSocket Setup

The avatar supports two modes of operation:

### A. Streaming Mode (Recommended)
The avatar "listens" to a system audio device for lip-sync.
1.  **Install BlackHole**: `brew install blackhole-2ch`
2.  **Route Audio**: Send your TTS output to **BlackHole 2ch**.
3.  **Auto-Connect**: The app automatically connects to "BlackHole" or "Cable" on startup.

### B. WebSocket Control (Advanced)
Send unified JSON commands for audio, reactions, and background via a single connection.
-   **Connect**: `ws://localhost:8000/ws`
-   **Audio**: `{ "type": "audio_chunk", "data": "BASE64..." }`
-   **Reaction**: `{ "type": "reaction", "name": "smile" }`
-   **Background**: `{ "type": "set_background", "color": "#00FF00" }`

## 5. macOS Virtual Camera (DAL Plugin)

### Compilation (macOS)
The provided files in `macos-virtualcam` are C++ sources for the logic.
To build a working DAL plugin, you need the Apple CoreMediaIO DAL Sample Project structure.

1. Download the **CoreMediaIO** sample from Apple or a modern fork.
2. Replace the stream logic with our `SharedMemoryReader`.
3. **Build** the bundle (`.plugin`).

### Installation (macOS)
1. Move plugin to `/Library/CoreMediaIO/Plug-Ins/DAL/`.
   ```bash
   sudo mv OpenClawAvatarCam.plugin /Library/CoreMediaIO/Plug-Ins/DAL/
   ```

### Signing (macOS)
Modern macOS (Ventura/Sonoma) blocks unsigned plugins in Zoom/Teams.
Ad-hoc sign:
```bash
codesign --force --deep --sign - /Library/CoreMediaIO/Plug-Ins/DAL/OpenClawAvatarCam.plugin
```

## 6. Windows Virtual Camera (DirectShow)

### Prerequisites
-   **Visual Studio** (with C++ Desktop Development)
-   **Windows SDK**
-   **DirectShow BaseClasses** (e.g., from [amc522/BaseClasses](https://github.com/amc522/BaseClasses) or similar).

### Compilation
1.  Navigate to `windows-virtualcam`.
2.  Open the files in Visual Studio or use the provided `CMakeLists.txt` (requires linking `strmbase.lib`).
3.  Build as **Release / x64** (or x86 if using 32-bit apps, but x64 is standard).
4.  Output: `OpenClawAvatarCam.dll`

### Installation
1.  Open **Command Prompt as Administrator**.
2.  Run:
    ```cmd
    regsvr32 OpenClawAvatarCam.dll
    ```
    *Success Message: "DllRegisterServer in ... succeeded."*

### Usage
The camera will run as **"OpenClaw AvatarCam"**.
The Electron App MUST be running (`npm start`) to feed data to it via `%TEMP%\openclaw_avatar.raw`.

## 7. Troubleshooting
-   **No Video**: Check if Electron is running.
-   **Green Screen**: Frame size mismatch (must be 1280x720).
-   **Windows DllRegisterServer failed**: Ensure you are running as Administrator and have the C++ Redists installed.
