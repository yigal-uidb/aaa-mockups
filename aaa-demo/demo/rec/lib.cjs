// Recording helpers: a CDP screencast of the page (sharp JPEG frames with timestamps, turned into a 30fps MP4),
// a visible cursor that glides between targets, and typing at a human pace.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CURSOR = `
(() => {
  if (window.top !== window || window.__cursor) return;
  window.__cursor = true;
  const add = () => {
    const c = document.createElement('div');
    c.id = '__cur';
    c.style.cssText = 'position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transform:translate(960px,540px);transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))';
    c.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"><path d="M4 2 L4 22 L9.5 17 L13.5 26 L17 24.5 L13 15.8 L20.5 15.8 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const r = document.createElement('div');
    r.id = '__ripple';
    r.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(36,104,176,.35);z-index:2147483646;pointer-events:none;opacity:0;transform:scale(.3)';
    document.documentElement.append(r, c);
  };
  if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
})();`;

async function setup(ctx) {
  await ctx.addInitScript(CURSOR);
}

const pos = new WeakMap();
async function cursorTo(page, x, y, ms = 650) {
  const from = pos.get(page) || { x: 960, y: 540 };
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const cx = from.x + (x - from.x) * e, cy = from.y + (y - from.y) * e;
    await page.mouse.move(cx, cy);
    await page.evaluate(([cx, cy]) => { const c = document.getElementById('__cur'); if (c) c.style.transform = `translate(${cx - 4}px,${cy - 2}px)`; }, [cx, cy]);
    await page.waitForTimeout(16);
  }
  pos.set(page, { x, y });
}
async function center(loc) {
  await loc.waitFor({ state: 'visible', timeout: 15000 });
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function hover(page, loc, ms) {
  const c = await center(loc);
  await cursorTo(page, c.x, c.y, ms);
  return c;
}
async function click(page, loc, { ms, wait = 350 } = {}) {
  const c = await hover(page, loc, ms);
  await page.waitForTimeout(140);
  await page.evaluate(([x, y]) => {
    const r = document.getElementById('__ripple');
    if (!r) return;
    r.style.left = x + 'px'; r.style.top = y + 'px';
    r.animate([{ opacity: 0.9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.4)' }], { duration: 450, easing: 'ease-out' });
  }, [c.x, c.y]);
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
  await page.waitForTimeout(wait);
}
async function type(page, text, delay = 38) {
  for (const ch of text) {
    await page.keyboard.insertText(ch);
    await page.waitForTimeout(delay + (ch === ' ' ? 25 : Math.random() * 25));
  }
}
async function scroll(page, dy, ms = 900) {
  const steps = Math.round(ms / 16);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await page.waitForTimeout(16);
  }
}

/** Starts recording the page; returns stop(name) that writes clips/<name>.mp4 and returns its duration. */
async function record(page, outDir, { w = 1920, h = 1080 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const dir = fs.mkdtempSync(path.join(outDir, '.frames-'));
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = path.join(dir, `${String(frames.length).padStart(6, '0')}.jpg`);
    frames.push({ file, t: metadata.timestamp });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  return async function stop(name) {
    const end = Date.now() / 1000;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
    const lines = [];
    for (let i = 0; i < frames.length; i++) {
      const next = i + 1 < frames.length ? frames[i + 1].t : end;
      lines.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, next - frames[i].t).toFixed(4)}`);
    }
    if (frames.length) lines.push(`file '${frames[frames.length - 1].file}'`);
    const list = path.join(dir, 'list.txt');
    fs.writeFileSync(list, lines.join('\n'));
    const out = path.join(outDir, `${name}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=30,scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', out]);
    fs.rmSync(dir, { recursive: true, force: true });
    const dur = end - (frames[0]?.t ?? t0);
    console.log(`clip ${name}: ${dur.toFixed(1)}s, ${frames.length} frames`);
    return dur;
  };
}

module.exports = { setup, cursorTo, hover, click, type, scroll, record, center };
