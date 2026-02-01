const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Create a dummy WAV (Sine Wave)
function createWav() {
    // 2 seconds of silence/noise
    const sampleRate = 44100;
    const duration = 2;
    const numSamples = sampleRate * duration;
    const buffer = Buffer.alloc(44 + numSamples * 2);

    // WAV Header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // Mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32); // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample
    buffer.write('data', 36);
    buffer.writeUInt32LE(numSamples * 2, 40);

    // Sine Wave Data
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const sample = Math.sin(2 * Math.PI * 440 * t) * 16000; // 440Hz Sine
        buffer.writeInt16LE(parseInt(sample), 44 + i * 2);
    }
    return buffer;
}

const wavBuffer = createWav();
const base64Audio = wavBuffer.toString('base64');
const outputPath = path.resolve(__dirname, '../output_test_enhanced.mp4');

const postData = JSON.stringify({
    audio_data: base64Audio,
    output_path: outputPath,
    background: { color: "#00FFFF" } // Cyan Background
});

const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/generate_video',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => console.log(`BODY: ${chunk}`));
    res.on('end', () => console.log('No more data in response.'));
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(postData);
req.end();
