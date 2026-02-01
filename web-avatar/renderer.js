// renderer.js
const { ipcRenderer } = window.require('electron');
const fs = window.require('fs');
const path = window.require('path');
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

// --- Configuration ---
const SCENE_WIDTH = 1280;
const SCENE_HEIGHT = 720;
const API_WS_URL = 'ws://localhost:8000/ws';

// --- Globals ---
let scene, camera, renderer;
let currentVrm = null;
let currentMixer = null;
let clock = new THREE.Clock();
let ws;
let audioContext, analyser, dataArray;
let isAudioInit = false;

// --- Logging Proxy ---
function proxyLog(level, args) {
    try {
        ipcRenderer.send('log-message', { level, message: args });
    } catch(e) {}
}
const originalIsAudioInit = false; // Just to avoid syntax error in diff

console.log = (...args) => proxyLog('INFO', args);
console.error = (...args) => proxyLog('ERROR', args);
console.warn = (...args) => proxyLog('WARN', args);

// --- Init Three.js ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00FF00); // Chroma Key Green or specific color

    camera = new THREE.PerspectiveCamera(30, SCENE_WIDTH / SCENE_HEIGHT, 0.1, 20.0);
    camera.position.set(0, 1.4, 1.5); // Approximate head shot position

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); // preserverDrawingBuffer needed for readPixels? actually gl.readPixels works anyway
    renderer.setSize(SCENE_WIDTH, SCENE_HEIGHT);
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    // Light
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(1.0, 1.0, 1.0).normalize();
    scene.add(light);
    


    // Connect WS
    // Auto-load Avatar
    loadDefaultAvatar();

    connectWebSocket();

    // Start Audio Stream (Microphone/BlackHole)
    initAudioStream();

    // Start Loop
    // animate(); 
    // Use setInterval for Headless stability (rAF throttles in background)
    setInterval(animate, 33); // ~30 FPS
}

// --- WebSocket & Logic ---
function connectWebSocket() {
    ws = new WebSocket(API_WS_URL);
    ws.onopen = () => console.log('Connected to Avatar API');
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };
    ws.onclose = () => setTimeout(connectWebSocket, 1000);
}

// --- Audio LipSync ---
// --- Audio Stream Logic ---
async function initAudioStream() {
    try {
        // Init AudioContext if needed (though browser might need user gesture)
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            console.log('AudioContext initialized');
            isAudioInit = true;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        console.log('Available Audio Inputs:', inputs.map(d => d.label));

        // Strategy: Look for "BlackHole" -> "Cable" -> Default
        let startDevice = inputs.find(d => d.label.toLowerCase().includes('blackhole'));
        if (!startDevice) startDevice = inputs.find(d => d.label.toLowerCase().includes('cable')); // VB-Cable
        if (!startDevice) startDevice = inputs[0];

        if (startDevice) {
            console.log(`Selecting Audio Input: ${startDevice.label} (${startDevice.deviceId})`);
            startStream(startDevice.deviceId);
        } else {
            console.warn('No audio input devices found.');
        }

    } catch (e) {
        console.error('Error listing devices:', e);
    }
}

async function startStream(deviceId) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: { exact: deviceId },
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false
            },
            video: false
        });

        // Create Source
        const source = audioContext.createMediaStreamSource(stream);
        
        // Connect Source -> Analyser
        source.connect(analyser);
        
        // DO NOT connect to destination (speakers) to avoid feedback!
        // analyser.connect(audioContext.destination); 
        
        console.log('Audio Stream Started & Analyzing');

        // Resume context if suspended
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

    } catch (e) {
        console.error('Error starting audio stream:', e);
    }
}

// --- Audio Playback (Legacy/Push) ---
function initAudio() {
    if (isAudioInit) return;
    initAudioStream(); // Reuse the stream init
}

// IPC Listeners
ipcRenderer.on('generate-video-direct', (event, data) => {
    console.log('[Renderer] Received Direct Generation Request');
    startVideoGeneration(data);
});

function handleMessage(data) {
    if (data.type === 'set_avatar') {
        loadVRM(data.path);
    } else if (data.type === 'reaction') {
        triggerReaction(data.name);
    } else if (data.type === 'audio_chunk') {
        // Play and Analyze
        playAudioChunk(data.data);
    } else if (data.type === 'set_background') {
        updateBackground(data);
    } else if (data.type === 'generate_video') {
        startVideoGeneration(data);
    }
}

// --- Video Generation Logic ---
let mediaRecorder;
let recordedChunks = [];

// Helper to load VRM via Promise
function loadVRMPromise(path) {
    return new Promise((resolve, reject) => {
        loadVRM(path, resolve); // Assuming loadVRM accepts a callback or we mod it.
        // If loadVRM doesn't have a callback, we might need a short timeout or event.
        // Looking at renderer.js, loadVRM is async loader.load(...)
        // Let's modify loadVRM signature first to accept callback? 
        // Or just rely on it being relatively fast? No, for video gen we need valid state.
        
        // BETTER APPROACH: Just wait a bit or modify loadVRM.
        // Let's assume for this MVP we just call it and wait a safe delay, 
        // OR better: modify loadVRM to be async.
    });
}

function startVideoGeneration({ audio_data, output_path, avatar, background }) {
    console.log('[Renderer] Starting video generation...');
    
    // 0. Setup Environment (Async)
    const setupPromise = new Promise((resolve) => {
        let setupTasks = [];
        
        if (background) {
            setupTasks.push(new Promise(r => {
                updateBackground(background);
                setTimeout(r, 500); // Give it a moment to load texture
            }));
        }
        
        if (avatar) {
            setupTasks.push(new Promise(r => {
                loadVRM(avatar);
                // Rough estimate for load time. Ideally we hook into loader events.
                // For MVP: wait 2 seconds if avatar changed
                setTimeout(r, 2000); 
            }));
        }
        
        Promise.all(setupTasks).then(resolve);
    });

    setupPromise.then(() => {
        // 1. Decode Audio
        if (!isAudioInit) initAudio();
        if (audioContext.state === 'suspended') audioContext.resume();

        const binaryString = window.atob(audio_data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

        audioContext.decodeAudioData(bytes.buffer, (audioBuffer) => {
             // 2. Setup MediaRecorder
             const canvas = renderer.domElement;
             const stream = canvas.captureStream(30); 
             
             const dest = audioContext.createMediaStreamDestination();
             const source = audioContext.createBufferSource();
             source.buffer = audioBuffer;
             source.connect(analyser);
             source.connect(dest);
             
             const tracks = dest.stream.getAudioTracks();
             if (tracks.length > 0) stream.addTrack(tracks[0]);

             recordedChunks = [];
             mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
             
             mediaRecorder.ondataavailable = (event) => {
                 if (event.data.size > 0) recordedChunks.push(event.data);
             };

             mediaRecorder.onstop = () => {
                 const blob = new Blob(recordedChunks, { type: 'video/webm' });
                 saveVideoFile(blob, output_path);
             };

             // 3. Start
             mediaRecorder.start();
             source.start(0);
             
             source.onended = () => {
                 console.log('[Renderer] Audio finished. Stopping recorder.');
                 mediaRecorder.stop();
             };

        }, (err) => console.error('Error decoding audio:', err));
    });
}

const { exec } = require('child_process');

async function saveVideoFile(blob, outputPath) {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Determine if we need to convert to MP4
    if (outputPath.endsWith('.mp4')) {
        const tempPath = outputPath.replace('.mp4', '_temp.webm');
        
        fs.writeFile(tempPath, buffer, (err) => {
            if (err) {
                console.error('Failed to save temp video:', err);
                return;
            }
            
            console.log(`[Renderer] Converting to MP4: ${tempPath} -> ${outputPath}`);
            
            // Use absolute path for macOS Homebrew or assume output from 'which' command
            // A more robust solution would be to check for ffmpeg existence or ask user for path.
            // For this environment, we know it is /opt/homebrew/bin/ffmpeg
            const ffmpegPath = '/opt/homebrew/bin/ffmpeg'; 
            
            // Also try 'ffmpeg' fallback if absolute fails (e.g. on Windows or other Mac setups)
            // But for now, let's just prepend the directory to PATH or use full path.
            // A common trick is to source profile, but exec doesn't do that.
            
            // Add crop filter for square video (1280x720 -> 720x720 center crop)
            // crop=w:h:x:y -> 720:720:280:0
            const command = `${ffmpegPath} -y -i "${tempPath}" -vf "crop=720:720:280:0" -c:v libx264 -preset fast -crf 22 -c:a aac "${outputPath}"`;
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    const msg = `[Renderer] FFmpeg Conversion Error: ${error.message}\nSTDERR: ${stderr}`;
                    console.error(msg);
                    console.warn(`[Renderer] Video left as WebM at: ${tempPath}`);
                    
                    // Log to file for debugging
                    fs.writeFile('ffmpeg_error.log', msg, () => {});
                    ipcRenderer.send('generation-done', { success: false });
                } else {
                    console.log(`[Renderer] Conversion Success! Saved to: ${outputPath}`);
                    // Cleanup temp
                    fs.unlink(tempPath, () => {});
                    ipcRenderer.send('generation-done', { success: true, path: outputPath });
                }
            });
        });
    } else {
        // Just save as WebM (or whatever was requested if not MP4)
        fs.writeFile(outputPath, buffer, (err) => {
            if (err) {
                console.error('Failed to save video:', err);
                ipcRenderer.send('generation-done', { success: false });
            } else {
                console.log(`[Renderer] Video saved into ${outputPath}`);
                ipcRenderer.send('generation-done', { success: true, path: outputPath });
            }
        });
    }
}

function updateBackground({ path, color }) {
    if (path) {
        new THREE.TextureLoader().load(path, (texture) => {
            scene.background = texture;
            console.log('Background updated to image:', path);
        }, undefined, (err) => console.error('Error loading background:', err));
    } else if (color) {
        scene.background = new THREE.Color(color);
        console.log('Background updated to color:', color);
    }
}

function playAudioChunk(base64Data) {
    if (!isAudioInit) initAudio();
    if (audioContext.state === 'suspended') audioContext.resume();

    // Decode Base64
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode Audio
    audioContext.decodeAudioData(bytes.buffer, (buffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);
        analyser.connect(audioContext.destination); // Output to default device (BlackHole if selected)
        source.start(0);
    }, (err) => console.error(err));
}

function updateLipSync() {
    if (!analyser || !currentVrm) return;

    analyser.getByteTimeDomainData(dataArray);
    
    // RMS Volume calculation (Time Domain is 128 centered)
    let sumSquares = 0;
    for(let i=0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128.0; // -1.0 to 1.0
        sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);
    
    // Sensitivity Multiplier (Tune as needed)
    // Speech RMS is often 0.1 - 0.5 range.
    const sensitivity = 5.0; 
    const openAmount = Math.min(1.0, rms * sensitivity);

    // Smooth transition could be added here, but for now direct mapping
    // Apply to 'aa' (preset 'aa' or 'MouthOpen')

    // Apply to 'aa' (preset 'aa' or 'MouthOpen')
    currentVrm.expressionManager.setValue('aa', openAmount);
}

function loadVRM(url) {
    // Ensure absolute paths are treated as file:// protocol
    if (!url.startsWith('http') && !url.startsWith('file://') && url.startsWith('/')) {
        url = 'file://' + url;
    }

    if (currentVrm) {
        scene.remove(currentVrm.scene);
        VRMUtils.deepDispose(currentVrm.scene);
    }

    const loader = new GLTFLoader();
    loader.register((parser) => {
        return new VRMLoaderPlugin(parser);
    });

    loader.load(
        url,
        (gltf) => {
            const vrm = gltf.userData.vrm;

            // Cleanup / Optimize
            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            VRMUtils.combineSkeletons(gltf.scene);

            vrm.scene.rotation.y = Math.PI; // Rotate model 180 if needed

            currentVrm = vrm;
            scene.add(vrm.scene);
            console.log('VRM Loaded');
            
            // Try Loading Default Animation
            loadDefaultAnimation();
        },
        (progress) => console.log('Loading model...', 100.0 * (progress.loaded / progress.total), '%'),
        (error) => console.error('Error loading VRM:', error)
    );
}

function loadDefaultAnimation() {
    try {
        const modelsParams = path.resolve(__dirname, '../models');
        if (fs.existsSync(modelsParams)) {
            const files = fs.readdirSync(modelsParams);
            const vrmaFile = files.find(f => f.endsWith('.vrma'));
            if (vrmaFile) {
                const fullPath = path.join(modelsParams, vrmaFile);
                console.log('Found default animation:', fullPath);
                loadAnimation(fullPath);
            } else {
                console.log('No .vrma animation found in models directory');
            }
        }
    } catch(e) {
        console.error('Error loading default animation:', e);
    }
}

function loadAnimation(url) {
    if (!url.startsWith('http') && !url.startsWith('file://') && url.startsWith('/')) {
        url = 'file://' + url;
    }

    const loader = new GLTFLoader();
    loader.register((parser) => {
        return new VRMAnimationLoaderPlugin(parser);
    });

    loader.load(
        url,
        (gltf) => {
            const vrmAnimations = gltf.userData.vrmAnimations;
            if (vrmAnimations == null) {
                 console.warn('VRMAnimation not found');
                 return;
            }

            const vrmAnimation = vrmAnimations[0]; // Take the first one

            if (currentVrm) {
               // Create Clip
               const clip = createVRMAnimationClip(vrmAnimation, currentVrm);
               
               // Create Mixer
               currentMixer = new THREE.AnimationMixer(currentVrm.scene);
               const action = currentMixer.clipAction(clip);
               action.play();
               console.log('Animation Loaded & Playing');
            } else {
                console.warn('Cannot play animation: No VRM loaded');
            }
        },
        undefined,
        (error) => console.error('Error loading Animation:', error)
    );
}

function triggerReaction(name) {
    if (!currentVrm || !currentVrm.expressionManager) return;

    // Simple expression trigger
    // Map names to VRM Expression Preset Names
    let presetName = null;
    switch(name.toLowerCase()) {
        case 'smile': presetName = 'happy'; break;
        case 'joy': presetName = 'happy'; break;
        case 'angry': presetName = 'angry'; break;
        case 'sorrow': presetName = 'sad'; break;
        case 'fun': presetName = 'relaxed'; break; // 'fun' not standard VRM 1.0, maybe 'relaxed' or custom
        case 'surprised': presetName = 'surprised'; break; 
    }

    if (presetName) {
        currentVrm.expressionManager.setValue(presetName, 1.0);
        setTimeout(() => {
            currentVrm.expressionManager.setValue(presetName, 0.0);
        }, 2000);
    }
}

// --- Render Loop ---
function animate() {
    // requestAnimationFrame(animate); // Managed by main loop setInterval

    const delta = clock.getDelta();

    if (currentVrm) {
        currentVrm.update(delta);
    }
    
    if (currentMixer) {
        currentMixer.update(delta);
    }
    
    // Blink Logic (Simple random)
    if (currentVrm && Math.random() < 0.005) {
            currentVrm.expressionManager.setValue('blink', 1.0);
            setTimeout(() => currentVrm.expressionManager.setValue('blink', 0.0), 100);
    }

    if (currentVrm) {
        updateLipSync();
    }
    
    renderer.render(scene, camera);
    captureAndSendFrame();
}

// --- Frame Capture ---
// Using readPixels is blocking and slowish (CPU readback). 
// For MVP 720p@30fps on decent Mac, it's acceptable.
const pixelBuffer = new Uint8Array(SCENE_WIDTH * SCENE_HEIGHT * 4);

function captureAndSendFrame() {
    const gl = renderer.getContext();
    // Read pixels (RGBA)
    // Note: gl.readPixels returns flipped Y usually? Three.js Renderer preserves buffer?
    // We check preservingDrawingBuffer: true
    
    // Reading straight from WebGL context
    gl.readPixels(0, 0, SCENE_WIDTH, SCENE_HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);

    // Convert RGBA to BGRA (CoreMedia preferred) or ensure Consumer expects RGBA
    // For simplicity, let's assume Consumer (C++) expects BGRA format.
    // Swapping R and B in JS is slow. Let's see if we can read BGRA? In WebGL 2 usually no.
    // We will do a manual swap or adjust the C++ reader to accept RGBA. 
    // -> Easier to Adjust C++ reader to RGBA?
    // -> Or do a quick swap loop here (might kill FPS).
    // Let's stick to RGBA and update C++ header.

    // Send to Main for SHM write
    // To limit IPC flooding, maybe throttle?
    ipcMainSend(pixelBuffer);
}

let lastSent = 0;
function ipcMainSend(buffer) {
    const now = Date.now();
    if (now - lastSent < 30) return; // Cap ~33ms (30fps)
    lastSent = now;

    // We copy buffer because the underlying ArrayBuffer might be detached or reused
    ipcRenderer.send('frame-data', { 
        buffer: buffer, 
        timestamp: now * 1000 // Microseconds for C++ if needed, or Millis
    });
}


init();

function loadDefaultAvatar() {
    try {
        // Resolve ../models relative to __dirname (renderer.js in web-avatar/)
        const modelsParams = path.resolve(__dirname, '../models');
        console.log('Scanning models dir:', modelsParams);

        if (fs.existsSync(modelsParams)) {
            const files = fs.readdirSync(modelsParams);
            const vrmFile = files.find(f => f.endsWith('.vrm'));
            if (vrmFile) {
                const fullPath = path.join(modelsParams, vrmFile);
                console.log('Found default avatar:', fullPath);
                loadVRM(fullPath);
            } else {
                console.warn('No .vrm files found in models directory');
            }
        } else {
             console.warn('Models directory not found:', modelsParams);
        }
    } catch(e) {
        console.error('Error loading default avatar:', e);
    }
}

