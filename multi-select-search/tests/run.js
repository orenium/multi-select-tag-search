// Runs every *.test.js in this folder.  node tests/run.js
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();

let failed = 0;
for (const file of files) {
  console.log('\n── ' + file + ' ' + '─'.repeat(Math.max(0, 50 - file.length)));
  try {
    process.stdout.write(execFileSync(process.execPath, [path.join(dir, file)]));
  } catch (err) {
    failed++;
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
  }
}

console.log('\n' + (failed ? `${failed} suite(s) FAILED` : `all ${files.length} suites passed`));
process.exit(failed ? 1 : 0);
