const { spawnSync } = require('child_process');
const path = require('path');

const binPath = path.resolve(__dirname, '../bin/avatarcam');

console.log('Running smoke test: avatarcam --help');

const result = spawnSync('node', [binPath, '--help'], {
    encoding: 'utf8',
    shell: true
});

if (result.error) {
    console.error('Failed to spawn process:', result.error);
    process.exit(1);
}

if (result.status !== 0) {
    console.error('Command failed with status:', result.status);
    console.error('Stderr:', result.stderr);
    console.error('Stdout:', result.stdout);
    process.exit(1);
}

console.log('Success! Output:');
console.log(result.stdout);
process.exit(0);
