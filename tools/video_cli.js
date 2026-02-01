#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

// Helper to print usage
function printUsage() {
    console.log(`
Usage: node video_cli.js --audio <path> --output <path> [options]

Options:
  --audio <path>       Path to input audio file (WAV/MP3/etc)
  --output <path>      Path to output video file (.mp4 or .webm)
  --avatar <path>      (Optional) Path to VRM avatar model
  --bg-image <path>    (Optional) Path to background image
  --bg-color <hex>     (Optional) Hex color for background (e.g., #00FF00)
  --api-url <url>      (Optional) API URL (default: http://localhost:8000)
    `);
}

// Parse Args
const args = process.argv.slice(2);
const params = {};

for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--audio': params.audioPath = args[++i]; break;
        case '--output': params.outputPath = args[++i]; break;
        case '--avatar': params.avatarPath = args[++i]; break;
        case '--bg-image': params.bgImage = args[++i]; break;
        case '--bg-color': params.bgColor = args[++i]; break;
        case '--api-url': params.apiUrl = args[++i]; break;
        case '--help': printUsage(); process.exit(0);
    }
}

if (!params.audioPath || !params.outputPath) {
    console.error('Error: --audio and --output are required.');
    printUsage();
    process.exit(1);
}

// Resolve Paths
const audioPath = path.resolve(params.audioPath);
const outputPath = path.resolve(params.outputPath);
const avatarPath = params.avatarPath ? path.resolve(params.avatarPath) : undefined;
const bgPath = params.bgImage ? path.resolve(params.bgImage) : undefined;

// Read Audio
if (!fs.existsSync(audioPath)) {
    console.error(`Error: Audio file not found at ${audioPath}`);
    process.exit(1);
}

console.log(`Reading audio from: ${audioPath}`);
const audioBuffer = fs.readFileSync(audioPath);
const base64Audio = audioBuffer.toString('base64');

// Construct Payload
const payload = {
    audio_data: base64Audio,
    output_path: outputPath
};

if (avatarPath) payload.avatar = avatarPath;
if (bgPath) payload.background = { path: bgPath };
if (params.bgColor) payload.background = { color: params.bgColor };

// Send Request
const apiUrl = params.apiUrl || 'http://localhost:8000';
console.log(`Sending request to ${apiUrl}/generate_video...`);

const postData = JSON.stringify(payload);
const url = new URL(`${apiUrl}/generate_video`);

const req = http.request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('Success:', JSON.parse(data));
            console.log('Video generation started. Please check the active Electron window logs for progress.');
        } else {
            console.error(`Error (${res.statusCode}):`, data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    console.error('Make sure the OpenClaw Avatar app is running!');
});

req.write(postData);
req.end();
