// Auto-generated proxy - Blue Team refactor
// Real file: ./hooks/auto-memory-hook.mjs
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const realFile = join(__dirname, 'hooks', 'auto-memory-hook.mjs');

spawn(process.argv[0], [realFile, ...process.argv.slice(2)], {
  stdio: 'inherit'
}).on('exit', (code) => process.exit(code ?? 0));
