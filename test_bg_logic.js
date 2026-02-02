
const path = require('path');
const fs = require('fs');

// Mock logic from standalone_gen.js
function resolveArgs(args) {
    return args.map((arg, idx) => {
        const prev = args[idx - 1];
        if (['--audio', '--output', '--avatar', '--bg-image'].includes(prev)) {
            return path.resolve(process.cwd(), arg);
        }
        if (prev === '--background') {
            const absPath = path.resolve(process.cwd(), arg);
            if (fs.existsSync(absPath)) {
                return absPath; // Path
            }
            return arg; // Color
        }
        return arg;
    });
}

// Test Cases
const cwd = process.cwd();
const existingFile = 'tools/avatarcam'; // Known file
const color = '#FF0000';

console.log('--- Testing Background Logic ---');

// Case 1: File
const args1 = ['--background', existingFile];
const resolvedFB = resolveArgs(args1);
console.log(`[File Test] Input: ${existingFile}`);
console.log(`[File Test] Output: ${resolvedFB[1]}`);
console.log(`[File Test] Is Absolute: ${path.isAbsolute(resolvedFB[1])}`);

// Case 2: Color
const args2 = ['--background', color];
const resolvedColor = resolveArgs(args2);
console.log(`[Color Test] Input: ${color}`);
console.log(`[Color Test] Output: ${resolvedColor[1]}`);
console.log(`[Color Test] Is Absolute: ${path.isAbsolute(resolvedColor[1]) && process.platform !== 'win32' ? 'Maybe (if color looks like path)' : 'No'}`);
// Note: on windows #FF0000 is not absolute path.

if (path.isAbsolute(resolvedFB[1]) && resolvedFB[1].includes('avatarcam')) {
    console.log('PASS: File path resolved correctly');
} else {
    console.log('FAIL: File path not resolved');
}

if (resolvedColor[1] === color) {
    console.log('PASS: Color kept as string');
} else {
    console.log('FAIL: Color changed');
}
