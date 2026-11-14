// Zepul yoldaş — ana süreç: çalışma alanı boyutunda saydam overlay, tepsi, kısayol, pencere takibi, boru API'si.
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut, powerMonitor, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { takipci, tamEkranMi, KABUK, overlayAlani } = require('./pencere.cjs');
const { boruBaslat } = require('./yoldas.cjs');

if (!app.requestSingleInstanceLock()) app.exit(0);

// ---------- ayarlar ----------
const AYAR_YOLU = () => path.join(app.getPath('userData'), 'ayarlar.json');
const VARSAYILAN = { sprite: 'pamuk', gosterim: '2d', ten: 'volt', olcek: 1, kose: 'sag', sessiz: true, ciddi: false, azHareket: false, dolas: true, claudeSoru: true, uyku: [23, 7] };
let ayar = { ...VARSAYILAN };
try { ayar = { ...VARSAYILAN, ...JSON.parse(fs.readFileSync(AYAR_YOLU(), 'utf8')) }; } catch {}
// GPU: 2D kipinde kapalı (saydam pencere yazılımla ~0 CPU); 3D (WebGL) için açık. 2D→3D geçişinde uygulama kendini
// yeniden başlatır (GPU kararı süreç başında verilir); 3D→2D canlı geçer.
const GPU_ACIK = ayar.gosterim === '3d';
if (!GPU_ACIK) app.disableHardwareAcceleration();
const kaydet = () => fs.writeFileSync(AYAR_YOLU(), JSON.stringify(ayar, null, 2));

const spriteKlasoru = () => (path.isAbsolute(ayar.sprite) ? ayar.sprite : path.join(__dirname, 'sprites', ayar.sprite));
let sonSheet = null;
function spriteGonder(yedek = false) {
  const dir = yedek ? path.join(__dirname, 'sprites', 'placeholder') : spriteKlasoru();
  try {
    const sheet = JSON.parse(fs.readFileSync(path.join(dir, 'sheet.json'), 'utf8'));
    const ikon = (...adlar) => { for (const ad of adlar) if (fs.existsSync(path.join(dir, 'icons', ad))) return path.join(dir, 'icons', ad); return null; };
    // Tepsi: icons/tepsi-renkli[-durum]-32.png (Pamuk sözleşmesi) ya da icons/tray.png (+ renderer durum noktası)
    const dosya = Object.fromEntries(Object.keys(DURUM_AD).map((d) => [d, ikon(`tepsi-renkli${d === 'bosta' ? '' : '-' + d}-32.png`)]));
    dosyaIkonlari = Object.values(dosya).every(Boolean) ? Object.fromEntries(Object.entries(dosya).map(([d, p]) => [d, nativeImage.createFromPath(p).toDataURL()])) : null;
    // Ten: SVG karelerindeki :root{--ten;--vurgu;--dolgu} değişkenleri seçilen tenle değiştirilip metin olarak gönderilir
    const ten = sheet.tints?.[ayar.ten];
    // Bellek: ten varsayılansa (ya da ten yoksa) hazır PNG sayfası (@1x) kullanılır — 69 SVG'nin çözülmüş hâlinden çok daha hafif.
    if (sheet.svgFrames && sheet.image1x && (!ten || ayar.ten === sheet.tint) && fs.existsSync(path.join(dir, sheet.image1x))) {
      const { svgFrames, ...png } = sheet;
      Object.assign(sheet, png, { svgFrames: undefined, image: sheet.image1x, frameW: sheet.frameW / 2, frameH: sheet.frameH / 2,
        anchor: sheet.anchor.map((v) => v / 2), scale: sheet.scale * 2 });
    }
    const svgMetin = sheet.svgFrames && ten ? Object.fromEntries(sheet.svgFrames.map((f) => [f,
      fs.readFileSync(path.join(dir, f), 'utf8').replace(new RegExp(`--(${Object.keys(ten).join('|')}):[^;}]*`, 'g'), (_m, k) => `--${k}:${ten[k]}`)])) : null;
    sonSheet = sheet;
    const url = (p) => p && pathToFileURL(p).href;
    win.webContents.send('sprite', { taban: pathToFileURL(dir).href + '/', sheet, svgMetin,
      ikon: { tepsi: url(ikon('tray.png')), avatar: url(ikon('avatar-64.png', 'avatar.png')) } });
    if (dosyaIkonlari && tray) { ikonlar = dosyaIkonlari; tepsiAyarla(tepsiDurum); }
    menuKur();
  } catch (e) {
    if (fs.existsSync(dir)) console.error('[yoldas] sprite okunamadı:', dir, e.message);
    if (!yedek) spriteGonder(true); // ayar korunur; sprite gelince (ör. sprites/pamuk) kendiliğinden kullanılır
  }
}

// ---------- overlay penceresi ----------
let win, tray, ikonlar = {}, dosyaIkonlari = null, tepsiDurum = 'bosta';
let elleGizli = false, dnd = false, tamEkran = false;
const bekleyenler = new Map(); // olay id → cevap çözücü
const sorular = new Map(); // cevaplanmamış sorular: id → ileti (en çok 10; tepsi "bekliyor" + menü maddesi)
const kuyruk = []; // gizliyken gelen olaylar (bildirim en çok 3)
const DUSTU = Symbol('dustu'); // soru düşürüldü (soran vazgeçti / başka yerden cevaplandı): cevap hiçbir yere iletilmez
const KAYNAK_AD = { zepul: 'Zepul', claude: 'Claude Code' };
let sayac = 0;

// Overlay alanı = çalışma alanı, her kenardan 1 px içeride: monitörü tam kaplayan her-zaman-üstte pencereyi
// Windows "tam ekran uygulama" sayar ve otomatik gizli görev çubuğu fareyle açılmaz.
const alan = () => overlayAlani(screen.getPrimaryDisplay().workArea);

function pencereKur() {
  const wa = alan();
  win = new BrowserWindow({
    x: wa.x, y: wa.y, width: wa.width, height: wa.height, show: false, frame: false, transparent: true,
    backgroundColor: '#00000000', hasShadow: false, resizable: false, movable: false, minimizable: false, maximizable: false,
    skipTaskbar: true, focusable: false, alwaysOnTop: true, type: 'toolbar', title: 'Zepul yoldaş',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', gorunurlukGuncelle);
  win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 'warning') console.log('[renderer]', e.message); });
  win.webContents.on('render-process-gone', (_e, d) => console.error('[yoldas] renderer çöktü:', d.reason));
  screen.on('display-metrics-changed', () => win.setBounds(alan()));
}

function gorunurlukGuncelle() {
  const goster = !elleGizli && !dnd && !tamEkran;
  if (goster && !win.isVisible()) { win.showInactive(); win.setAlwaysOnTop(true, 'floating'); }
  if (!goster && win.isVisible()) win.hide();
  win.webContents.send('gorunur', goster);
  if (goster) while (kuyruk.length) win.webContents.send('olay', kuyruk.shift());
  menuKur();
}

// Olayı renderer'a ilet (görünmüyorsa kuyruğa al); renderer cevaplayınca (tık/düğme/20 sn) çözülür.
// Soru: `sure` (varsayılan 20 sn) dolunca null ile çözülür; sure 0 = süresiz; cevapKanali yoksa soket kapanınca düşer.
// Etiket: konu (ilk harf büyük) ya da kaynak adı; sira varsa " · 2/3".
function olayGonder(m, baglanti) {
  const ad = m.konu ? m.konu[0].toLocaleUpperCase('tr') + m.konu.slice(1) : KAYNAK_AD[m.kaynak] ?? m.kaynak;
  const etiket = [ad, m.sira].filter(Boolean).join(' · ');
  const ileti = { ...m, id: ++sayac, etiket };
  console.log(`[yoldas] olay ${ileti.id}: ${m.tip}${m.alt ? '/' + m.alt : ''}${etiket ? ' [' + etiket + ']' : ''}${m.cevapKanali ? ' (' + m.cevapKanali + ')' : ''}`); // metin günlüğe yazılmaz
  if (m.alt === 'hata') tepsiAyarla('hata');
  const p = new Promise((f) => bekleyenler.set(ileti.id, f));
  if (m.tip === 'soru') {
    sorular.set(ileti.id, ileti);
    if (m.sure !== 0) { // 0: süresiz (cevap, soket kapanması ya da iptal bekler)
      const sure = (m.sure ?? 20) * 1000;
      ileti.bitis = Date.now() + sure; // renderer: balon bu ana kadar; sonrası main'in zamanlayıcısı (gizliyken de)
      const t = setTimeout(() => dusur(ileti.id, null), sure + 500);
      p.finally(() => clearTimeout(t));
    }
    if (!m.cevapKanali) baglanti?.kapaninca(() => dusur(ileti.id));
    if (sorular.size > 10) dusur(sorular.keys().next().value, null);
    tepsiAyarla('bekliyor');
  }
  if (win.isVisible()) win.webContents.send('olay', ileti);
  else {
    kuyruk.push(ileti);
    const bildirimler = kuyruk.filter((x) => x.tip !== 'soru');
    if (bildirimler.length > 3) { kuyruk.splice(kuyruk.indexOf(bildirimler[0]), 1); coz(bildirimler[0].id, null); }
  }
  return p;
}
// Olayı çöz (bir kez); tepsi: soru kaldıysa "bekliyor", yoksa bekliyor/hata → boşta.
function coz(id, cevap) {
  const f = bekleyenler.get(id);
  if (!f) return false;
  bekleyenler.delete(id); sorular.delete(id);
  f(cevap);
  const d = sorular.size ? 'bekliyor' : tepsiDurum === 'bekliyor' || tepsiDurum === 'hata' ? 'bosta' : tepsiDurum;
  if (d !== tepsiDurum) tepsiAyarla(d); else menuKur();
  return true;
}
// Soruyu renderer'dan sessizce kaldır (kuyruk, bekleyen, açık balon). cevap null: süre doldu / kuyruk taştı.
function dusur(id, cevap = DUSTU) {
  if (!coz(id, cevap)) return;
  console.log(`[yoldas] olay ${id} düştü${cevap === null ? ' (süre doldu / kuyruk taştı)' : ''}`);
  const i = kuyruk.findIndex((x) => x.id === id);
  if (i >= 0) kuyruk.splice(i, 1);
  win.webContents.send('dusur', id);
}

// ---------- tepsi ----------
const DURUM_AD = { bosta: 'boşta', calisiyor: 'çalışıyor', bekliyor: 'bekliyor', hata: 'hata' };
function tepsiAyarla(d) {
  tepsiDurum = d;
  if (tray && ikonlar[d]) tray.setImage(nativeImage.createFromDataURL(ikonlar[d]));
  tray?.setToolTip(`Zepul yoldaş — ${DURUM_AD[d]}`);
  win?.webContents.send('durum', d);
  menuKur();
}

const test = (tip, metin, ek = {}) => () => olayGonder({ tip, metin, secenekler: [], ...ek });
const komut = (ad) => () => win.webContents.send('komut', { ad });
function menuSablon() {
  const ilk = sorular.values().next().value;
  return [
    ...(ilk ? [{ label: `Bekleyen soru: ${ilk.etiket || 'soru'}`.replace(/&/g, '&&'), click: () => win.webContents.send('komut', { ad: 'soru-ac' }) }, { type: 'separator' }] : []),
    { label: elleGizli ? 'Göster' : 'Gizle', accelerator: 'Ctrl+Alt+Z', click: () => { elleGizli = !elleGizli; gorunurlukGuncelle(); } },
    { label: 'Rahatsız etme', type: 'checkbox', checked: dnd, click: (i) => { dnd = i.checked; gorunurlukGuncelle(); } },
    { label: 'Sessiz kip', type: 'checkbox', checked: ayar.sessiz, click: (i) => { ayar.sessiz = i.checked; kaydet(); win.webContents.send('ayar', ayar); } },
    { label: 'Etrafta dolaşsın', type: 'checkbox', checked: ayar.dolas !== false, click: (i) => ayarDegis({ dolas: i.checked }) },
    // claudeSoru: ~/.claude/araclar/soru-kancasi.mjs okur; kapalıysa AskUserQuestion terminalde kalır.
    { label: "Claude Code sorularını yakala", type: "checkbox", checked: ayar.claudeSoru !== false, click: (i) => { ayar.claudeSoru = i.checked; kaydet(); } },
    { label: 'Gösterim', submenu: [['2d', '2D sprite'], ['3d', 'Gerçek zamanlı 3D']].map(([d, ad]) => ({ label: ad, type: 'radio', checked: ayar.gosterim === d,
      click: () => ayarDegis({ gosterim: d }) })) },
    { label: 'Ciddi mod', type: 'checkbox', checked: !!ayar.ciddi, click: (i) => ayarDegis({ ciddi: i.checked }) },
    { label: 'Az hareket', type: 'checkbox', checked: !!ayar.azHareket, click: (i) => ayarDegis({ azHareket: i.checked }) },
    { label: 'Ten', submenu: ['volt', 'aura', 'auraGece'].map((t) => ({ label: t, type: 'radio', checked: ayar.ten === t,
      click: () => { ayarDegis({ ten: t }); spriteGonder(); } })) },
    { label: 'Ölçek', submenu: [0.75, 1, 1.5].map((o) => ({ label: String(o).replace('.', ','), type: 'radio', checked: ayar.olcek === o,
      click: () => { ayar.olcek = o; kaydet(); win.webContents.send('ayar', ayar); } })) },
    { type: 'separator' },
    { label: 'Test: Bildirim', click: test('bildirim', 'Merhaba! Yeni bir bildirim var.') },
    { label: 'Test: Soru', click: test('soru', 'Değişiklikleri kaydedeyim mi?', { secenekler: ['Onayla', 'Reddet'] }) },
    { label: 'Test: Ajan bitti', click: test('bildirim', 'Ajan işini bitirdi.', { alt: 'bitti' }) },
    { label: 'Test: Hata', click: test('bildirim', 'Bir hata oluştu (test).', { alt: 'hata' }) },
    { label: 'Test: Uyku', click: komut('uyku') },
    { label: 'Test: Tırman', click: komut('tirman') },
    { label: 'Test: Saklan', click: komut('saklan') },
    { type: 'separator' },
    { label: 'Sprite seç (klasör)…', click: spriteSec },
    { label: 'Çıkış', click: () => app.quit() },
  ];
}
function ayarDegis(o) {
  Object.assign(ayar, o); kaydet();
  if (ayar.gosterim === '3d' && !GPU_ACIK) { app.relaunch(); app.exit(0); return; } // WebGL için GPU'lu yeniden başlat
  win.webContents.send('ayar', ayar); menuKur();
}
function menuKur() { tray?.setContextMenu(Menu.buildFromTemplate(menuSablon())); }

async function spriteSec() {
  const r = await dialog.showOpenDialog({ title: 'sheet.json içeren sprite klasörü', properties: ['openDirectory'], defaultPath: path.join(__dirname, 'sprites') });
  if (r.canceled || !r.filePaths[0]) return;
  if (!fs.existsSync(path.join(r.filePaths[0], 'sheet.json'))) { dialog.showErrorBox('Zepul yoldaş', 'Klasörde sheet.json yok.'); return; }
  ayar.sprite = r.filePaths[0]; kaydet(); spriteGonder();
}

// ---------- renderer IPC ----------
const kendi = (e) => e.sender === win?.webContents;
ipcMain.on('hazir', (e) => { if (!kendi(e)) return; win.webContents.send('ayar', ayar); spriteGonder(); win.webContents.send('durum', tepsiDurum); });
ipcMain.on('fare', (e, ustunde) => { if (kendi(e)) win.setIgnoreMouseEvents(!ustunde, { forward: true }); });
ipcMain.on('menu', (e) => { if (kendi(e)) Menu.buildFromTemplate(menuSablon()).popup({ window: win }); });
ipcMain.on('cevap', (e, id, cevap) => {
  if (!kendi(e)) return;
  coz(id, cevap ?? null);
});
ipcMain.on('ikonlar', (e, o) => {
  if (!kendi(e)) return;
  ikonlar = dosyaIkonlari || o;
  if (!tray) {
    tray = new Tray(nativeImage.createFromDataURL(o.bosta));
    tray.on('click', () => { elleGizli = !elleGizli; gorunurlukGuncelle(); });
    menuKur();
  }
  tepsiAyarla(tepsiDurum);
});
ipcMain.handle('imlec', (e) => {
  if (!kendi(e)) return null;
  const p = screen.getCursorScreenPoint(), wa = alan();
  return { x: p.x - wa.x, y: p.y - wa.y };
});
let takipHwnd = 0;
ipcMain.on('takip', (e, h) => { if (kendi(e)) { takipHwnd = Number(h) || 0; yokla(); } });

// ---------- ön plan penceresi takibi ----------
let takip, sonGonderilen = '';
function dipRect([l, t, r, b]) { // fiziksel ekran → overlay (DIP, çalışma alanına göre)
  const wa = alan();
  const d = screen.screenToDipRect(null, { x: l, y: t, width: r - l, height: b - t });
  return { l: d.x - wa.x, t: d.y - wa.y, r: d.x + d.width - wa.x, b: d.y + d.height - wa.y };
}
async function yokla() {
  const y = await takip.sor(takipHwnd);
  if (!y || !win) return;
  const kendiH = Number(win.getNativeWindowHandle().readBigUInt64LE());
  const on = y.on && y.on.h !== kendiH ? y.on : null; // kendi overlay'imizi dışla
  if (on) {
    const tam = tamEkranMi(on, screen.dipToScreenRect(null, screen.getPrimaryDisplay().bounds));
    if (tam !== tamEkran) { tamEkran = tam; console.log('[yoldas] tam ekran:', tam, on.c, on.r.join(',')); gorunurlukGuncelle(); }
  }
  const ileti = {
    istenen: takipHwnd,
    aktif: on && !KABUK.has(on.c) ? { h: on.h, ...dipRect(on.r), z: !!on.z, i: !!on.i } : null,
    takip: y.takip ? { h: y.takip.h, ...dipRect(y.takip.r), z: !!y.takip.z, i: !!y.takip.i, v: !!y.takip.v } : null,
  };
  const s = JSON.stringify(ileti);
  if (s !== sonGonderilen) { sonGonderilen = s; win.webContents.send('pencere', ileti); }
}

// ---------- Zepul AI bağlantısı (README "Zepul bağlantısı") ----------
// Soru cevapKanali ("zepul:<kimlik>" ya da "soru:<kimlik>") ile geldiyse seçim (zaman aşımı/kapatma = null) Zepul'e, balon uygulamasının
// kullandığı yerel yoldan gider: 127.0.0.1 paneli + panel token'ı (Zepul klasöründen okunur, günlüğe yazılmaz). Yeni port açılmaz.
const ZEPUL = process.env.ZEPUL_AI_DIZIN || path.join(require('node:os').homedir(), 'Desktop', 'zepul-ai');
function zepuleIlet(kanal, cevap) {
  const id = kanal.slice(kanal.indexOf(':') + 1);
  let koken = 'http://127.0.0.1:8830', token = '';
  try { const u = new URL(fs.readFileSync(path.join(ZEPUL, '.tmp', 'panel-url.txt'), 'utf8').trim()); if (u.hostname === '127.0.0.1') koken = u.origin; } catch {}
  try { token = fs.readFileSync(path.join(ZEPUL, 'veri', 'token'), 'utf8').trim(); } catch {}
  if (!token) return console.error('[yoldas] Zepul cevabı iletilemedi: Zepul klasörü bulunamadı');
  fetch(`${koken}/api/yoldas-cevap`, { method: 'POST', headers: { 'x-token': token, 'content-type': 'application/json' },
    body: JSON.stringify({ id, cevap: cevap ?? null }), signal: AbortSignal.timeout(5000) })
    .then((r) => console.log(`[yoldas] Zepul cevabı iletildi (${id}): ${r.status}`))
    .catch((e) => console.error(`[yoldas] Zepul cevabı iletilemedi (${id}): ${e.message}`));
}
// Zepul'ün sessiz saatleri (Ayarlar → Proaktif, açıksa) Pamuk'un gece uykusu yerine geçer; okunamazsa ayarlar.json'daki uyku.
function uykuSaatleri() {
  try {
    const o = JSON.parse(fs.readFileSync(path.join(ZEPUL, 'veri', 'odak.json'), 'utf8'));
    const s = (t) => Number(/^(\d{1,2}):\d{2}$/.exec(t)?.[1]);
    if (o.saat_acik && Number.isInteger(s(o.saat_bas)) && Number.isInteger(s(o.saat_bit))) return [s(o.saat_bas), s(o.saat_bit)];
  } catch {}
  return ayar.uyku;
}

// ---------- uyku (gece saatleri ya da 30 dk hareketsizlik) ----------
let uyku = null;
function uykuKontrol() {
  const s = new Date().getHours(), [bas, bit] = uykuSaatleri();
  const gece = bas > bit ? s >= bas || s < bit : s >= bas && s < bit;
  const u = gece || powerMonitor.getSystemIdleTime() >= 30 * 60;
  if (u !== uyku) { uyku = u; win.webContents.send('uyku', u); }
}

// ---------- başlat ----------
app.whenReady().then(() => {
  pencereKur();
  takip = takipci();
  setInterval(yokla, 1000);
  win.webContents.on('did-finish-load', () => { uyku = null; uykuKontrol(); });
  setInterval(uykuKontrol, 60_000);
  globalShortcut.register('Ctrl+Alt+Z', () => { elleGizli = !elleGizli; gorunurlukGuncelle(); });
  boruBaslat((m, baglanti) => {
    if (m.tip === 'iptal') { for (const [id, s] of sorular) if (s.cevapKanali === m.cevapKanali) dusur(id); return { ok: true }; }
    if (m.tip === 'durum') {
      if (!DURUM_AD[m.metin]) return { hata: 'durum: bosta|calisiyor|bekliyor|hata' };
      tepsiAyarla(m.metin); return { ok: true };
    }
    if (m.tip === 'test' && (m.metin === '2d' || m.metin === '3d')) { ayarDegis({ gosterim: m.metin }); return { ok: true }; }
    // Test görüntüsü: yalnız overlay'in kendi içeriği (kullanıcının ekranı değil); YOLDAS_CEKIM ortam değişkeni verilmişse.
    if (m.tip === 'test' && m.metin.startsWith('cek:') && process.env.YOLDAS_CEKIM) {
      const ad = m.metin.slice(4).replace(/[^\w-]/g, '').slice(0, 60) || 'cekim';
      return win.webContents.capturePage().then((img) => { fs.writeFileSync(path.join(process.env.YOLDAS_CEKIM, ad + '.png'), img.toPNG()); fs.writeFileSync(path.join(process.env.YOLDAS_CEKIM, ad + '.json'), sonGonderilen); return { ok: true }; });
    }
    if (m.tip === 'test') { win.webContents.send('komut', { ad: m.metin, hwnd: m.hwnd }); return { ok: true }; }
    return olayGonder(m, baglanti).then((c) => {
      if (c === DUSTU) return { cevap: null };
      if (m.cevapKanali) zepuleIlet(m.cevapKanali, c);
      return { cevap: c };
    });
  });
});
app.on('window-all-closed', () => {}); // tepsi uygulaması: pencere kapansa da yaşar
app.on('will-quit', () => { globalShortcut.unregisterAll(); takip?.kapat(); });
