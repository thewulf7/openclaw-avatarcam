#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get generic args
const args = process.argv.slice(2);

// Path to the Electron app (current directory's parent/web-avatar)
const appPath = path.resolve(__dirname, '../web-avatar');

// Resolve Electron Binary from web-avatar node_modules
let electronPath = path.resolve(appPath, 'node_modules/.bin/electron');

// Windows compatibility
if (process.platform === 'win32') {
    electronPath += '.cmd';
}

if (!fs.existsSync(electronPath)) {
    console.error(`[CLI] Error: Electron not found at ${electronPath}`);
    console.error(`[CLI] Please run 'npm install' in ${appPath}`);
    process.exit(1);
}

// Helper to resolve generic args to absolute paths if they look like paths
const resolvedArgs = args.map((arg, idx) => {
    const prev = args[idx - 1];
    if (['--audio', '--output', '--avatar', '--bg-image'].includes(prev)) {
        return path.resolve(process.cwd(), arg);
    }
    return arg;
});

// Construct arguments for Electron
// We pass appPath as the app path, followed by our custom flags
const electronArgs = [appPath, '--generate-video', ...resolvedArgs];

console.log(`[CLI] Launching Standalone Generator...`);
console.log(`[CLI] Command: ${electronPath} ${electronArgs.join(' ')}`);

const child = spawn(electronPath, electronArgs, {
    stdio: 'inherit', // Pipe logs to console
    env: process.env
});

child.on('close', (code) => {
    console.log(`[CLI] Generator exited with code ${code}`);
    process.exit(code);
});
