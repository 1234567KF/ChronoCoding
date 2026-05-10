#!/usr/bin/env node
/**
 * monitor-autostart — auto-start monitor server if not already running
 *
 * Called from SessionStart hook. Checks port 3456, starts monitor in background if down.
 */

const { exec } = require('child_process');
const net = require('net');
const path = require('path');

const PORT = 3456;
const MONITOR_DIR = path.resolve(__dirname, '..', '..', '监测者', 'monitor');

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

async function main() {
  const running = await checkPort(PORT);
  if (running) {
    console.log('[monitor-autostart] Monitor already running on port', PORT);
    return;
  }

  console.log('[monitor-autostart] Starting monitor...');
  const child = exec('node src/server.js', {
    cwd: MONITOR_DIR,
    windowsHide: true,
    stdio: 'ignore',
  });
  child.unref();
  child.on('error', (err) => {
    console.error('[monitor-autostart] Failed to start monitor:', err.message);
  });

  // Give it a moment to start
  await new Promise((r) => setTimeout(r, 1500));
  const ok = await checkPort(PORT);
  console.log('[monitor-autostart] Monitor', ok ? 'started OK' : 'may still be starting...');
}

main().catch((e) => console.error('[monitor-autostart] Error:', e.message));
