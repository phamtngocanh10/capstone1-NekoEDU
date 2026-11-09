// Start the local demo, reuse healthy servers, and open the default browser.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.resolve(backend, '../frontend');
const website = 'http://127.0.0.1:5173';
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore', windowsHide: true,
      });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exitCode = code;
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());

async function ready(url, kind) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    if (kind === 'backend') {
      const body = await response.json();
      return body.status === 'ok' && body.service === 'NEKO Edu API';
    }
    const html = await response.text();
    return html.includes('/@vite/client') && html.includes('<title>NEKO EDU</title>');
  } catch {
    return false;
  }
}

function portInUse(port) {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = occupied => { socket.destroy(); resolve(occupied); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(true));
  });
}

async function ensureServer({ name, kind, url, port, command, args, cwd }) {
  if (stopping) throw new Error('Da dung demo.');
  if (await ready(url, kind)) {
    if (kind === 'backend') {
      const contract = await fetch('http://127.0.0.1:8000/api/v1/manager/catalog', {
        signal: AbortSignal.timeout(3000),
      });
      if (contract.status !== 401) {
        throw new Error('Backend dang chay ma cu. Dung terminal Backend cu bang Ctrl+C, roi chay lai lenh demo.');
      }
    }
    console.log(`[Demo] ${name} dang chay; dung lai server hien co.`);
    return;
  }
  if (await portInUse(port)) {
    throw new Error(`Cong ${port} dang bi chuong trinh khac su dung. Kiem tra terminal ${name}.`);
  }
  console.log(`[Demo] Dang khoi dong ${name}...`);
  const child = spawn(command, args, { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  let launchError;
  child.once('error', error => { launchError = error; });
  child.once('exit', code => {
    if (!stopping) {
      console.error(`[Demo] ${name} da dung (ma ${code}).`);
      stop(code || 1);
    }
  });
  const deadline = Date.now() + 45000;
  while (!stopping && Date.now() < deadline) {
    if (launchError) throw launchError;
    if (await ready(url, kind)) return;
    await delay(300);
  }
  throw new Error(`${name} chua san sang sau 45 giay. Xem loi o terminal nay.`);
}

try {
  const python = path.join(backend, '.venv/Scripts/python.exe');
  if (!existsSync(python) || !existsSync(path.join(frontend, 'node_modules'))) {
    throw new Error('Thieu .venv Backend hoac node_modules Frontend. Can cai moi truong truoc khi demo.');
  }
  await ensureServer({
    name: 'Backend', kind: 'backend', port: 8000,
    url: 'http://127.0.0.1:8000/api/v1/health', cwd: backend, command: python,
    args: ['-m', 'flask', '--app', 'run', 'run', '--host', '127.0.0.1', '--port', '8000', '--no-reload', '--no-debugger'],
  });
  await ensureServer({
    name: 'Frontend', kind: 'frontend', port: 5173, url: website, cwd: frontend,
    command: process.execPath,
    // Supply local-demo options here so frontend/vite.config.js stays exactly
    // as downloaded from the team's Git repository.
    args: [path.join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
      '--port', '5173', '--strictPort', '--clearScreen', 'false'],
  });
  if (stopping) throw new Error('Da dung demo.');
  const worker = spawn(python, ['-m', 'flask', '--app', 'run', 'process-pending-work', '--watch'], {
    cwd: backend, stdio: 'inherit', windowsHide: true,
  });
  children.push(worker);
  worker.once('error', error => { console.error(`[Demo] Xu ly hen gio: ${error.message}`); stop(1); });
  worker.once('exit', code => { if (!stopping) { console.error(`[Demo] Xu ly hen gio da dung (${code}).`); stop(code || 1); } });
  console.log('[Demo] Da bat xu ly thong bao/diem hen gio va nhac han (30 giay/lan).');
  console.log(`[Demo] BE + FE san sang: ${website}`);
  if (!process.argv.includes('--no-open')) {
    const opener = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Start-Process -FilePath '${website}'`], { windowsHide: true, stdio: 'ignore' });
    await new Promise((resolve, reject) => {
      opener.once('error', reject);
      opener.once('exit', code => code === 0 ? resolve() : reject(new Error('Khong mo duoc trinh duyet.')));
    });
    console.log('[Demo] Da gui lenh mo website bang trinh duyet mac dinh.');
  }
  console.log(children.length
    ? '[Demo] Giu terminal nay mo. Ctrl+C dung cac server do lan chay nay tao.'
    : '[Demo] Server dang duoc quan ly boi terminal cu. Lan chay nay da hoan tat.');
} catch (error) {
  if (!stopping) {
    console.error(`[Demo] ${error.message}`);
    stop(1);
  }
}
