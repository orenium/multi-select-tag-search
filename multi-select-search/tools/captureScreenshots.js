// Captures the Chrome Web Store screenshots from the REAL extension running
// on REAL sites — no mock-ups.
//
//   node tools/captureScreenshots.js
//
// How: launches headless Chrome with remote debugging, drives it over the
// DevTools Protocol (a ~90-line WebSocket client below, so there are no
// dependencies), injects the extension's own content files into the live
// page exactly as the popup does, ticks real tags, and screenshots at
// 1280x800 — the store's required size.
//
// The popup is browser chrome and cannot appear in a page screenshot, so it
// is captured separately from its own real HTML and composited onto the
// scene. Every pixel in the output is the real UI.

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'store', 'screenshots');
const PORT = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

// ── minimal WebSocket client (RFC 6455, client→server frames masked) ──

class WS {
  constructor(url) {
    const u = new URL(url);
    this.pending = Buffer.alloc(0);
    this.handlers = [];
    this.socket = net.connect(Number(u.port), u.hostname);
    this.ready = new Promise((resolve, reject) => {
      this.socket.on('error', reject);
      this.socket.once('connect', () => {
        const key = crypto.randomBytes(16).toString('base64');
        this.socket.write(
          `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
          `Host: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
        );
      });
      const onHandshake = (chunk) => {
        this.pending = Buffer.concat([this.pending, chunk]);
        const end = this.pending.indexOf('\r\n\r\n');
        if (end === -1) return;
        const head = this.pending.slice(0, end).toString();
        if (!/101/.test(head)) return reject(new Error('handshake failed: ' + head));
        this.pending = this.pending.slice(end + 4);
        this.socket.removeListener('data', onHandshake);
        this.socket.on('data', (d) => this._onData(d));
        this._drain();
        resolve();
      };
      this.socket.on('data', onHandshake);
    });
  }

  _onData(chunk) {
    this.pending = Buffer.concat([this.pending, chunk]);
    this._drain();
  }

  // Reassembles frames (screenshots arrive fragmented and 64-bit sized).
  _drain() {
    for (;;) {
      const buf = this.pending;
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0;
      const opcode = buf[0] & 0x0f;
      let len = buf[1] & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2); offset = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2)); offset = 10;
      }
      if (buf.length < offset + len) return;
      const payload = buf.slice(offset, offset + len);
      this.pending = buf.slice(offset + len);

      if (opcode === 0x8) { this.socket.end(); return; }
      if (opcode === 0x9) { this._send(0xa, payload); continue; } // ping → pong
      this.frag = (opcode === 0x0) ? Buffer.concat([this.frag, payload]) : payload;
      if (!fin) continue;
      const text = this.frag.toString('utf8');
      this.frag = Buffer.alloc(0);
      for (const h of this.handlers) h(text);
    }
  }

  _send(opcode, payload) {
    const mask = crypto.randomBytes(4);
    const masked = Buffer.from(payload);
    for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
    let header;
    if (masked.length < 126) {
      header = Buffer.from([0x80 | opcode, 0x80 | masked.length]);
    } else if (masked.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode; header[1] = 0x80 | 126;
      header.writeUInt16BE(masked.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode; header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(masked.length), 2);
    }
    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  send(text) { this._send(0x1, Buffer.from(text, 'utf8')); }
  onMessage(fn) { this.handlers.push(fn); }
  close() { try { this.socket.end(); } catch (_) {} }
}

// ── CDP session ──────────────────────────────────────────────────────

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.waiting = new Map();
    this.events = [];
    ws.onMessage((text) => {
      const msg = JSON.parse(text);
      if (msg.id && this.waiting.has(msg.id)) {
        const { resolve, reject } = this.waiting.get(msg.id);
        this.waiting.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const h of this.events) h(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.waiting.delete(id)) reject(new Error('timeout: ' + method));
      }, 60000);
    });
  }

  onEvent(fn) { this.events.push(fn); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STORE_SIZE = [1280, 800]; // the only size the Web Store accepts here

function pngSize(file) {
  const b = fs.readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

// ── the extension bundle, read from the same list the popup injects ───

function contentBundle() {
  const popup = fs.readFileSync(path.join(ROOT, 'src/popup/popup.js'), 'utf8');
  const block = popup.match(/const CONTENT_FILES = \[([\s\S]*?)\];/);
  const files = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return files.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
}

// ── page helpers ─────────────────────────────────────────────────────

class Page {
  constructor(cdp, sessionId) { this.cdp = cdp; this.sid = sessionId; }

  async init(width = 1280, height = 800) {
    await this.cdp.send('Page.enable', {}, this.sid);
    await this.cdp.send('Runtime.enable', {}, this.sid);
    await this.cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile: false }, this.sid);
    await this.cdp.send('Emulation.setUserAgentOverride', { userAgent: UA }, this.sid);
  }

  async goto(url, settleMs = 3500) {
    await this.cdp.send('Page.navigate', { url }, this.sid);
    await sleep(settleMs);
  }

  async eval(expression) {
    const res = await this.cdp.send('Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true }, this.sid);
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ||
                      res.exceptionDetails.text);
    }
    return res.result.value;
  }

  async shot(file, exact) {
    // deviceScaleFactor is 1, so the PNG comes out at exactly the viewport
    // size — the Chrome Web Store accepts ONLY 1280x800 or 640x400 here, and
    // a 2x "retina" capture is rejected for being 2560x1600.
    const { data } = await this.cdp.send('Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: false }, this.sid);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    const [w, h] = pngSize(file);
    if (exact && (w !== exact[0] || h !== exact[1])) {
      throw new Error(path.basename(file) + ' came out ' + w + 'x' + h +
                      ', expected ' + exact.join('x'));
    }
    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    console.log('  \u2713 ' + path.basename(file) + '  ' + w + 'x' + h + '  (' + kb + ' KB)');
  }

  async resize(width, height) {
    await this.cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile: false }, this.sid);
  }

  // Consent banners, sign-in nags and ad slots are the site's furniture, not
  // ours — they'd only make the screenshots harder to read. Dismiss buttons
  // are clicked for real where the site provides them; the rest are hidden.
  async declutter() {
    return this.eval(`(() => {
      const clicked = [];
      const byText = (needles) => [...document.querySelectorAll('button, a')]
        .find(el => needles.some(n => (el.textContent || '').trim().toLowerCase() === n));

      const consent = byText(['necessary cookies only', 'reject all', 'accept all cookies']);
      if (consent) { consent.click(); clicked.push(consent.textContent.trim()); }

      const closers = [
        '[data-testid="promptable__x"]', '.imdb-signin-prompt button',
        'button[aria-label="Close"]', 'button[title="Close"]'
      ];
      for (const sel of closers) {
        for (const el of document.querySelectorAll(sel)) {
          try { el.click(); clicked.push(sel); } catch (_) {}
        }
      }

      const hide = [
        '[data-testid="promptable"]', '.js-consent-banner', '#onetrust-banner-sdk',
        '[id^="google_ads"]', 'iframe[src*="ads"]', 'iframe[id*="ad"]',
        '.js-sidebar-ad', '[class*="advert"]', '[id*="dfp"]',
        '.s-sidebarwidget--content [class*="ad"]', 'div[data-ad]',
        'aside[aria-label*="ad" i]'
      ];
      let hidden = 0;
      for (const sel of hide) {
        for (const el of document.querySelectorAll(sel)) {
          el.style.setProperty('display', 'none', 'important');
          hidden++;
        }
      }
      // Leftover ad chrome ("Report this ad" links and their empty slots)
      for (const el of document.querySelectorAll('a, div')) {
        if (/^report this ad$/i.test((el.textContent || '').trim())) {
          const slot = el.closest('div');
          (slot || el).style.setProperty('display', 'none', 'important');
          hidden++;
        }
      }

      // Sponsored question rows on Stack Overflow
      for (const el of document.querySelectorAll('.s-post-summary, .js-post-summary')) {
        if (/sponsored/i.test(el.textContent || '')) {
          el.style.setProperty('display', 'none', 'important');
          hidden++;
        }
      }
      return { clicked, hidden };
    })()`);
  }
}

// ── main ─────────────────────────────────────────────────────────────

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'msq-shot-'));

  console.log('launching Chrome…');
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--disable-gpu',
    '--allow-file-access-from-files',
    '--window-size=1280,800'
  ], { stdio: 'ignore' });

  let version;
  for (let i = 0; i < 40; i++) {
    try { version = await httpJson(`http://127.0.0.1:${PORT}/json/version`); break; }
    catch (_) { await sleep(500); }
  }
  if (!version) { chrome.kill(); throw new Error('Chrome did not expose a debugging port'); }

  const ws = new WS(version.webSocketDebuggerUrl);
  await ws.ready;
  const cdp = new CDP(ws);

  const newPage = async () => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(cdp, sessionId);
    await page.init();
    return page;
  };

  const BUNDLE = contentBundle();
  const shots = [];

  try {
    // ── Scene 1: IMDb, three interests ticked ────────────────────────
    console.log('\n1/5  IMDb title page');
    const imdb = await newPage();
    await imdb.goto('https://www.imdb.com/title/tt0111161/', 5000);
    console.log('     declutter:', JSON.stringify(await imdb.declutter()));
    await imdb.eval(BUNDLE);
    await imdb.eval("MSQ.command('activate')");
    await sleep(800);
    await imdb.eval(`(() => {
      const pick = ['Period Drama', 'Prison Drama', 'Psychological Drama'];
      for (const label of pick) {
        const chip = [...document.querySelectorAll('a.msq-selectable')]
          .find(a => a.textContent.trim().includes(label));
        if (chip) chip.click();
      }
      // Frame so the chips and the action bar sit in the upper third and the
      // hero video is mostly out of shot — the extension is the subject here.
      const chips = document.querySelector('[data-testid="interests"]');
      const y = chips.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, y - 545));
      return true;
    })()`);
    await sleep(600);
    const f1 = path.join(OUT, '01-imdb-select.png');
    await imdb.shot(f1, STORE_SIZE); shots.push(f1);

    // ── Scene 2: the results — proof it is an intersection ───────────
    console.log('2/5  IMDb combined results');
    const results = await newPage();
    await results.goto(
      'https://www.imdb.com/search/title/?interests=in0000083,in0000085,in0000086', 5000);
    await results.eval('window.scrollTo(0, 210); true');
    await sleep(500);
    const f2 = path.join(OUT, '02-imdb-results.png');
    await results.shot(f2, STORE_SIZE); shots.push(f2);

    // ── Scene 3: Stack Overflow, tags across different questions ─────
    console.log('3/5  Stack Overflow question list');
    const so = await newPage();
    await so.goto('https://stackoverflow.com/questions', 6000);
    console.log('     declutter:', JSON.stringify(await so.declutter()));
    await so.eval(BUNDLE);
    await so.eval("MSQ.command('activate')");
    await sleep(800);
    const picked = await so.eval(`(() => {
      // one tag from each of the first three visible questions — the
      // cross-item case the in-page bar alone cannot show
      const rows = [...document.querySelectorAll('.s-post-summary')]
        .filter(r => r.offsetParent !== null).slice(0, 3);
      const labels = [];
      for (const row of rows) {
        const chip = row.querySelector('a.msq-selectable');
        if (chip) { chip.click(); labels.push(chip.textContent.trim().replace(/^✓/, '')); }
      }
      window.scrollTo(0, 0);
      return labels;
    })()`);
    console.log('     picked:', picked);
    await sleep(600);
    const f3 = path.join(OUT, '03-stackoverflow-cross-item.png');
    await so.shot(f3, STORE_SIZE); shots.push(f3);

    // ── Scene 4: the real popup, captured at its real size ───────────
    console.log('4/5  extension popup');
    const popup = await newPage();
    await popup.init(320, 400);
    await popup.goto('file://' + path.join(ROOT, 'src/popup/popup.html'), 1500);
    const popupHeight = await popup.eval(`(() => {
      applyState({
        supported: true, active: true, siteLabel: 'IMDb', host: 'imdb.com',
        items: [
          { id: 'i:1', label: 'Period Drama' },
          { id: 'i:2', label: 'Prison Drama' },
          { id: 'i:3', label: 'Psychological Drama' }
        ],
        searchUrl: 'https://www.imdb.com/search/title/?interests=in0000083,in0000085,in0000086'
      });
      return Math.ceil(document.documentElement.getBoundingClientRect().height);
    })()`);
    // Fit the viewport to the popup so nothing is clipped.
    await popup.resize(320, popupHeight);
    await sleep(300);
    const popupPng = path.join(OUT, 'popup-raw.png');
    await popup.shot(popupPng);
    console.log('     popup height:', popupHeight + 'px');

    // ── Scene 5: composite — real page + real popup, side by side ────
    console.log('5/5  composite scene');
    const composite = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { margin:0; width:1280px; height:800px; overflow:hidden;
             background:#0e1014; font-family:Roboto,Arial,sans-serif; color:#fff; }
      .page { position:absolute; inset:0; }
      .page img { width:1280px; display:block; filter:brightness(0.30) saturate(0.6) blur(1.5px); }
      /* Keeps the headline legible whatever the page behind it looks like. */
      .scrim { position:absolute; inset:0;
               background:linear-gradient(100deg,
                 rgba(14,16,20,.97) 0%, rgba(14,16,20,.93) 42%, rgba(14,16,20,.55) 100%); }
      .fg { position:absolute; inset:0; display:flex; align-items:center;
            gap:64px; padding:0 76px; }
      .copy { flex:1; max-width:600px; }
      h1 { font-size:48px; line-height:1.08; margin:0 0 20px; letter-spacing:-0.025em; }
      h1 em { font-style:normal; color:#f5c518; }
      p { font-size:20px; line-height:1.55; color:#c9cdd4; margin:0; }
      .pop { flex:none; border-radius:14px; overflow:hidden;
             box-shadow:0 36px 90px rgba(0,0,0,.8); }
      .pop img { display:block; width:320px; }
    </style></head><body>
      <div class="page"><img src="${path.basename(shots[0])}"></div>
      <div class="scrim"></div>
      <div class="fg">
        <div class="copy">
          <h1>Tick several tags.<br>Get <em>one</em> combined search.</h1>
          <p>The tags already on the page become checkboxes. The panel keeps every
             tag you pick — even from different items — and one click opens the
             search that matches all of them at once.</p>
        </div>
        <div class="pop"><img src="${path.basename(popupPng)}"></div>
      </div>
    </body></html>`;
    const compFile = path.join(OUT, '_composite.html');
    fs.writeFileSync(compFile, composite);
    const comp = await newPage();
    await comp.goto('file://' + compFile, 1200);
    const f4 = path.join(OUT, '04-popup-overview.png');
    await comp.shot(f4, STORE_SIZE); shots.push(f4);
    fs.rmSync(compFile, { force: true });
    fs.rmSync(popupPng, { force: true });

    console.log('\nVerifying dimensions…');
    let bad = 0;
    for (const file of shots) {
      const [w, h] = pngSize(file);
      const ok = w === STORE_SIZE[0] && h === STORE_SIZE[1];
      if (!ok) bad++;
      console.log('  ' + (ok ? '\u2713' : '\u2717') + ' ' + w + 'x' + h + '  ' +
                  path.relative(ROOT, file));
    }
    if (bad) throw new Error(bad + ' screenshot(s) are not exactly 1280x800');
    console.log('\nAll ' + shots.length + ' ready to upload.');
  } finally {
    ws.close();
    chrome.kill();
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch (_) {}
  }
})().catch((err) => {
  console.error('✗ ' + err.message);
  process.exit(1);
});
