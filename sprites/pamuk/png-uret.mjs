// Başsız Chrome (kendi profil klasörü, kendi CDP portu, yalnız kendi PID'si kapatılır) ile:
//   sheet.png (@2x, 256 px hücre) + sheet@1x.png + icons/*.png + avatar PNG'leri + ekran/kareler.png (kontak) + ekran/onizleme-*.png
//   node png-uret.mjs [--port 9620] [--sadece sayfa|ikon|kareler|ekran] [--kopya <klasör>]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (ad, vars) => (argv.includes(ad) ? argv[argv.indexOf(ad) + 1] : vars);
const port = +arg('--port', 9620), sadece = arg('--sadece', ''), kopya = arg('--kopya', '');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sheet = JSON.parse(readFileSync(join(DIR, 'sheet.json'), 'utf8'));
mkdirSync(join(DIR, 'ekran'), { recursive: true });

// ---- Chrome ----
const profil = mkdtempSync(join(tmpdir(), 'pamuk-cdp-'));
const chrome = spawn(CHROME, ['--headless=new', '--allow-file-access-from-files', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
console.log('chrome pid', chrome.pid, 'port', port);
for (let i = 0; ; i++) { try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { if (i > 60) throw new Error('Chrome açılmadı'); await new Promise((r) => setTimeout(r, 250)); } }

let ws, id = 0; const bekleyen = new Map(), konsol = [];
const g = (method, params = {}) => new Promise((r) => { const i = ++id; bekleyen.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
async function sekme(url, w, h) {
  if (ws) ws.close();
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m); bekleyen.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') konsol.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') konsol.push(m.params.args.map((a) => a.value ?? a.description).join(' ')); };
  await g('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await g('Page.enable'); await g('Runtime.enable');
  const yuklendi = new Promise((r) => { const eski = ws.onmessage; ws.onmessage = (e) => { eski(e); if (JSON.parse(e.data).method === 'Page.loadEventFired') r(); }; });
  await g('Page.navigate', { url });
  await yuklendi;
}
const calistir = async (js) => { const r = await g('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const pngYaz = (dosya, dataUrl) => writeFileSync(dosya, Buffer.from(dataUrl.split(',')[1], 'base64'));
const ekranGorutusu = async (dosya, clip) => { const r = await g('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); writeFileSync(dosya, Buffer.from(r.result.data, 'base64')); };
const sayfaUrl = pathToFileURL(join(DIR, 'onizleme.html')).href;

// sayfadaki yardımcı: SVG'leri Image olarak yükleyip tuvale çizer
const YARDIMCI = `window.__yukle = (ad) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error('yüklenemedi ' + ad)); i.src = ad; });
window.__tuval = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };`;

try {
  await sekme(sayfaUrl, 1366, 768);
  await calistir(YARDIMCI);
  const cikti = [];
  if (!sadece || sadece === 'sayfa') { // sprite sayfaları
    for (const [dosya, hucre] of [['sheet.png', 256], ['sheet@1x.png', 128]]) {
      const url = await calistir(`(async () => { const F = ${JSON.stringify(sheet.svgFrames)}, S = ${sheet.columns}, H = ${hucre};
        const c = __tuval(S * H, Math.ceil(F.length / S) * H), x = c.getContext('2d');
        for (let i = 0; i < F.length; i++) { const im = await __yukle(F[i]); x.drawImage(im, (i % S) * H, Math.floor(i / S) * H, H, H); }
        return c.toDataURL('image/png'); })()`);
      pngYaz(join(DIR, dosya), url); cikti.push(dosya);
    }
  }
  if (!sadece || sadece === 'ikon') { // ikonlar + avatar
    const ikonlar = ['tepsi-acik', 'tepsi-koyu', 'tepsi-renkli'].flatMap((a) => ['', '-calisiyor', '-bekliyor', '-hata'].map((r) => a + r));
    for (const ad of ikonlar) for (const b of [16, 24, 32]) {
      const url = await calistir(`(async () => { const c = __tuval(${b}, ${b}); c.getContext('2d').drawImage(await __yukle('icons/${ad}.svg'), 0, 0, ${b}, ${b}); return c.toDataURL('image/png'); })()`);
      pngYaz(join(DIR, 'icons', `${ad}-${b}.png`), url);
    }
    for (const b of [64, 128]) {
      const url = await calistir(`(async () => { const c = __tuval(${b}, ${b}); c.getContext('2d').drawImage(await __yukle('icons/avatar.svg'), 0, 0, ${b}, ${b}); return c.toDataURL('image/png'); })()`);
      pngYaz(join(DIR, 'icons', `avatar-${b}.png`), url);
    }
    cikti.push('icons/*.png');
  }
  if (!sadece || sadece === 'kareler') { // kontak sayfası: tüm kareler etiketli, gri zemin (inceleme için)
    const url = await calistir(`(async () => { const F = ${JSON.stringify(sheet.svgFrames)}, S = 10, H = 128;
      const c = __tuval(S * H, Math.ceil(F.length / S) * (H + 16)), x = c.getContext('2d'); x.fillStyle = '#6e7684'; x.fillRect(0, 0, c.width, c.height);
      x.font = '11px Segoe UI, Arial'; x.fillStyle = '#fff';
      for (let i = 0; i < F.length; i++) { const im = await __yukle(F[i]), px = (i % S) * H, py = Math.floor(i / S) * (H + 16);
        x.strokeStyle = 'rgba(255,255,255,.25)'; x.strokeRect(px + .5, py + .5, H - 1, H - 1); x.drawImage(im, px, py, H, H); x.fillText(F[i].replace('.svg', ''), px + 4, py + H + 12); }
      return c.toDataURL('image/png'); })()`);
    pngYaz(join(DIR, 'ekran', 'kareler.png'), url); cikti.push('ekran/kareler.png');
  }
  if (!sadece || sadece === 'ekran') { // önizleme ekran görüntüleri
    await calistir('pamuk.hazir()');
    await ekranGorutusu(join(DIR, 'ekran', 'onizleme-tam.png'));
    const masa = { x: 20, y: 0, width: 1326, height: 560 };
    const kutu = await calistir(`JSON.stringify(document.getElementById('masa').getBoundingClientRect())`);
    Object.assign(masa, (({ x, y, width, height }) => ({ x, y, width, height }))(JSON.parse(kutu)));
    for (const [ad, konum, duvar, kare] of [['idle', 'zemin', 'koyu', 0], ['walk', 'zemin', 'acik', 2], ['fly', 'zemin', 'foto', 1], ['sit', 'pencere', 'koyu', 0], ['peek', 'kenar', 'acik', 0], ['climb', 'duvar', 'foto', 1], ['wave', 'zemin', 'koyu', 1], ['work', 'zemin', 'acik', 1], ['error', 'zemin', 'foto', 0], ['sleep', 'zemin', 'koyu', 1]]) {
      await calistir(`pamuk.duvar('${duvar}'); pamuk.konum('${konum}'); pamuk.oynat('${ad}'); pamuk.kare(${kare}); pamuk.hazir()`);
      await new Promise((r) => setTimeout(r, 150));
      await ekranGorutusu(join(DIR, 'ekran', `onizleme-${ad}.png`), masa);
    }
    await calistir(`pamuk.konum('zemin'); pamuk.duvar('koyu'); pamuk.olcek(1.5); pamuk.oynat('idle'); pamuk.kare(0)`);
    await new Promise((r) => setTimeout(r, 150));
    await ekranGorutusu(join(DIR, 'ekran', 'onizleme-olcek15.png'), masa);
    const serit = JSON.parse(await calistir(`(() => { scrollTo(0, 0); const b = document.querySelector('.satir').getBoundingClientRect(); return JSON.stringify({ x: b.x, y: b.y + scrollY, width: b.width, height: b.height }); })()`));
    const r = await g('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...serit, scale: 1 } });
    writeFileSync(join(DIR, 'ekran', 'onizleme-serit.png'), Buffer.from(r.result.data, 'base64'));
    cikti.push('ekran/onizleme-*.png');
  }
  if (kopya) { // aynı seti motor klasörüne kopyala (ekran/ hariç)
    mkdirSync(join(kopya, 'icons'), { recursive: true });
    for (const d of ['sheet.png', 'sheet@1x.png']) copyFileSync(join(DIR, d), join(kopya, d));
    const { readdirSync } = await import('node:fs');
    for (const d of readdirSync(join(DIR, 'icons'))) copyFileSync(join(DIR, 'icons', d), join(kopya, 'icons', d));
    cikti.push('kopya → ' + kopya);
  }
  console.log('yazıldı:', cikti.join(', '), konsol.length ? '\nKONSOL: ' + konsol.join(' | ') : '(konsol temiz)');
} finally {
  try { await g('Browser.close'); } catch {}
  await new Promise((r) => setTimeout(r, 400));
  if (chrome.exitCode == null) chrome.kill();
  await new Promise((r) => setTimeout(r, 300));
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
  console.log('chrome kapatıldı (pid ' + chrome.pid + ')');
}
