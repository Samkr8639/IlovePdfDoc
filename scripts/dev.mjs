import { spawn } from 'node:child_process';

console.log('Starting PDFTailor Full-Stack Development Environment (API + Web)...');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const api = spawn(npmCmd, ['--workspace=apps/api', 'run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

const web = spawn(npmCmd, ['--workspace=apps/web', 'run', 'start'], {
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\nShutting down dev servers...');
  try { api.kill(); } catch {}
  try { web.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

