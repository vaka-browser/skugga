'use strict';
/* Tor-motorn i Skugga: startar den medföljande tor-binären, väntar in
 * bootstrap och exponerar SOCKS-porten + "ny identitet" (NEWNYM).
 * Ingen webbtrafik ska någonsin gå utanför den här proxyn. */
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

let proc = null;
let socksPort = 0;
let controlPort = 0;
let cookiePath = '';
let state = { phase: 'off', progress: 0, error: '' };
const listeners = new Set();

function onState(fn) { listeners.add(fn); fn(state); }
function setState(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) { try { fn(state); } catch {} }
}
function getState() { return state; }
function getSocksPort() { return socksPort; }

function torRoot(resourcesPath) {
  // Paketerad app: resources/tor-bundle ; dev: ./tor-bundle
  const packed = path.join(resourcesPath || '', 'tor-bundle');
  if (resourcesPath && fs.existsSync(path.join(packed, 'tor', 'tor'))) return packed;
  return path.join(__dirname, 'tor-bundle');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
    srv.on('error', reject);
  });
}

async function start({ dataDir, resourcesPath }) {
  if (proc) return { socksPort };
  const root = torRoot(resourcesPath);
  const bin = path.join(root, 'tor', 'tor');
  const geoip = path.join(root, 'data', 'geoip');
  const geoip6 = path.join(root, 'data', 'geoip6');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  socksPort = await freePort();
  controlPort = await freePort();
  cookiePath = path.join(dataDir, 'control_auth_cookie');

  const args = [
    '--DataDirectory', dataDir,
    '--SocksPort', `127.0.0.1:${socksPort}`,
    '--ControlPort', `127.0.0.1:${controlPort}`,
    '--CookieAuthentication', '1',
    '--CookieAuthFile', cookiePath,
    '--ClientOnly', '1',
    '--Log', 'notice stdout',
  ];
  if (fs.existsSync(geoip)) args.push('--GeoIPFile', geoip);
  if (fs.existsSync(geoip6)) args.push('--GeoIPv6File', geoip6);

  setState({ phase: 'starting', progress: 0, error: '' });
  proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let buf = '';
  proc.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      const m = line.match(/Bootstrapped (\d+)%/);
      if (m) {
        const p = parseInt(m[1], 10);
        setState({ phase: p >= 100 ? 'ready' : 'boot', progress: p });
      }
      if (/\[err\]/.test(line)) setState({ error: line.replace(/^.*\[err\]\s*/, '').slice(0, 200) });
    }
  });
  proc.stderr.on('data', () => {});
  proc.on('exit', (code) => {
    proc = null;
    if (bootPoll) { clearInterval(bootPoll); bootPoll = null; }
    if (state.phase !== 'stopping') setState({ phase: 'error', error: state.error || ('tor avslutades (kod ' + code + ')') });
  });

  // AUKTORITATIV progress: fråga kontrollporten direkt i stället för att lita på
  // att stdout-raderna når oss (de gör det inte alltid i den paketerade appen →
  // uppkopplingslåset fastnade på 0 % fast tor var klar). Pollas tills done.
  startBootstrapPoll();
  return { socksPort };
}

let bootPoll = null;
function startBootstrapPoll() {
  if (bootPoll) clearInterval(bootPoll);
  let tries = 0;
  bootPoll = setInterval(async () => {
    tries++;
    try {
      const out = await controlCmd(['GETINFO status/bootstrap-phase']);
      const pm = out.match(/PROGRESS=(\d+)/);
      const done = /TAG=done/.test(out);
      if (pm) {
        const p = parseInt(pm[1], 10);
        setState({ phase: (done || p >= 100) ? 'ready' : 'boot', progress: p });
      }
      if (done || (pm && parseInt(pm[1], 10) >= 100)) { clearInterval(bootPoll); bootPoll = null; }
    } catch (e) {
      // Kontrollporten kan vara oåtkomlig de första sekunderna (cookie ej skriven än) — försök igen.
      if (tries > 120) { clearInterval(bootPoll); bootPoll = null; }
    }
  }, 1200);
}

function stop() {
  if (!proc) return;
  setState({ phase: 'stopping' });
  try { proc.kill(); } catch {}
  proc = null;
}

/* Minimal kontrollport-klient (cookie-auth) för SIGNAL NEWNYM m.m. */
function controlCmd(cmds) {
  return new Promise((resolve, reject) => {
    let cookie;
    try { cookie = fs.readFileSync(cookiePath).toString('hex'); }
    catch (e) { reject(new Error('ingen kontroll-cookie: ' + e.message)); return; }
    const sock = net.connect(controlPort, '127.0.0.1');
    const all = ['AUTHENTICATE ' + cookie, ...cmds];
    let idx = 0, out = '', pending = '';
    const sendNext = () => {
      if (idx < all.length) { pending = ''; sock.write(all[idx++] + '\r\n'); }
      else { try { sock.end('QUIT\r\n'); } catch {} resolve(out); }
    };
    sock.setTimeout(8000, () => { sock.destroy(); reject(new Error('kontrollport-timeout')); });
    sock.on('data', (d) => {
      pending += d.toString(); out += d.toString();
      // Svar är komplett när en rad "NNN <text>" (mellanslag, inte bindestreck) kommit.
      const lines = pending.split(/\r?\n/).filter(Boolean);
      const fin = lines.find((l) => /^\d{3} /.test(l));
      if (!fin) return;
      if (!/^2/.test(fin)) { sock.destroy(); reject(new Error(fin.slice(0, 200))); return; }
      sendNext();
    });
    sock.on('error', reject);
    sock.on('connect', sendNext);
  });
}

async function newIdentity() {
  await controlCmd(['SIGNAL NEWNYM']);
}

module.exports = { start, stop, onState, getState, getSocksPort, newIdentity };
