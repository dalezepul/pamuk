// Davranış makinesi + çizim döngüsü.
// Durumlar ("rutin" içinde): idle (köşe, görev çubuğu üstü) · wander (kısa gezinti) · climb (ekranın sağ kenarından
// aktif pencerenin üstüne) · hide (ekran kenarından peek / pencere arkasına batma) · event (balon) · sleep · dnd (main gizler).
// Her davranış bir async fonksiyon; calistir() öncekini iptal eder (IPTAL ile reddedilir) ve yenisini başlatır.
// Gösterim kipi: '2d' = sprite tuvali (#k), '3d' = Kivil/Pamuk three.js modülü (#k3). Davranış aynı; yalnız çizim değişir.
'use strict';
const Y = window.yoldas;
const kanvas = document.getElementById('k');
const ctx = kanvas.getContext('2d', { willReadFrequently: true });
const kanvas3 = document.getElementById('k3');
const balon = document.getElementById('b'), balonMetin = document.getElementById('bm'), balonDugme = document.getElementById('bd');
const balonAvatar = document.getElementById('ba'), balonKaynak = document.getElementById('bky');

const HIZ = 140; // süzülme hızı, px/sn
const IPTAL = Symbol('iptal');
const DINLENME = { calisiyor: 'work', bekliyor: 'wait', hata: 'error' };
// 3D: sprite animasyon adı → modül durumu (DURUM_ADLARI: bosta dinliyor dusunuyor eylemde konusuyor onay-bekliyor hata uyku)
const DURUM3 = { idle: 'bosta', walk: 'bosta', climb: 'bosta', fly: 'bosta', peek: 'bosta', peek_side: 'bosta', peek_top: 'bosta',
  hide: 'bosta', sit: 'bosta', wave: 'eylemde', idle_serious: 'bosta', speak_serious: 'konusuyor',
  think: 'dusunuyor', work: 'dinliyor', speak: 'konusuyor', wait: 'onay-bekliyor', error: 'hata', sleep: 'uyku' };
const BOYUT3 = 112, CAPA3 = [0.5, 0.88], PEEK3 = 0.5, BATIK3 = 0.5; // 3D tuval: CSS px, ayak çapası, kenar/pencere peek oranları
const TEK_KARE = { frames: [0], fps: 1, loop: true };
let S = null, Z = null, kip = '2d', ayar = { olcek: 1, kose: 'sag', sessiz: true, gosterim: '2d', dolas: true }, durum = 'bosta';
let gorunur = true, uykuda = false, olayda = false;
let aktif = null, takipBilgi = null, takipIstenen = 0, takipBekleyen = null;
let spriteIkon = {}, spriteTaban = '';
const kuyruk = [];
const bekleyen = []; // ilk açılışta (~20 sn) cevaplanmayan sorular: Pamuk'a tıklayınca sıradaki yeniden açılır
// Karakter (uçar, bacaksız): x,y = çapa noktası, overlay (çalışma alanı) koordinatında. yon: 1 sağa, -1 sola (kareler sağa bakar).
// sakli: saklandığı yer (yoksa null) · pen/pr: bağlı pencere hwnd + dikdörtgeni · ortu: pencere dikdörtgeni karakterden kırpılır.
const k = { x: 0, y: 0, yon: -1, anim: 'idle', kare: 0, kareT: 0, sakli: null, pen: 0, pr: null, ortu: false };

// 3D kipinde modülün kendi rAF döngüsü: hareket yokken 10 fps (saklıyken 6 fps) zamanlayıcıya iner, overlay gizliyken hiç çalışmaz.
const yerelRaf = window.requestAnimationFrame.bind(window), yerelIptal = window.cancelAnimationFrame.bind(window);
const askida = new Set();
window.requestAnimationFrame = (cb) => {
  if (kip !== '3d') return yerelRaf(cb);
  if (!gorunur) { askida.add(cb); return 0; }
  if (hedef || surukleniyor) return yerelRaf(cb);
  return -setTimeout(() => cb(performance.now()), 1000 / (k.sakli ? 6 : 10));
};
window.cancelAnimationFrame = (id) => (id < 0 ? clearTimeout(-id) : yerelIptal(id));

const W = () => innerWidth, H = () => innerHeight;
// Geometri: 2D'de sprite karesi, 3D'de BOYUT3 tuvali (ikisi de ölçek ayarıyla).
function olcu() {
  if (kip === '3d') { const f = BOYUT3 * ayar.olcek; return { fw: f, fh: f, ax: f * CAPA3[0], ay: f * CAPA3[1], gor: PEEK3, ust: BATIK3 }; }
  const s = S.scale * ayar.olcek;
  return { fw: S.frameW * s, fh: S.frameH * s, ax: S.anchor[0] * s, ay: S.anchor[1] * s, gor: S.peekVisible, ust: S.sheet?.peekTop || 0.62 };
}
const gen = () => olcu().fw, yuk = () => olcu().fh, yarim = () => gen() / 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const anim = () => (kip === '3d' ? TEK_KARE : S.animations[k.anim] || S.animations.idle);

// ---------- çizim ----------
let cizilen = '', sonKutu = null;
function ciz() {
  if (!S) return;
  const { fw, fh, ax, ay } = olcu();
  const ust = k.y - ay;
  let sol, el;
  if (kip === '3d') {
    el = kanvas3; sol = k.x - ax;
    const don = hedef && !k.ortu ? k.yon * 6 : 0; // süzülürken gidiş yönüne hafif eğim (kırpılırken eğim yok: kırpma yerel uzayda)
    if (el._fw !== fw) { el.style.width = el.style.height = fw + 'px'; el._fw = fw; }
    el.style.transform = `translate(${sol}px,${ust}px) rotate(${don}deg)`;
    Z?.lookAt(k.yon * (hedef ? 0.6 : k.sakli ? 0.8 : 0.3), 0);
  } else {
    el = kanvas; sol = k.yon > 0 ? k.x - ax : k.x - (fw - ax);
    const a = anim(), anahtar = `${k.anim}:${k.kare}:${fw}`;
    if (anahtar !== cizilen) {
      cizilen = anahtar;
      const dpr = devicePixelRatio || 1, pw = Math.round(fw * dpr), ph = Math.round(fh * dpr);
      if (kanvas.width !== pw || kanvas.height !== ph) { kanvas.width = pw; kanvas.height = ph; kanvas.style.width = fw + 'px'; kanvas.style.height = fh + 'px'; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, fw, fh);
      S.ciz(ctx, a.frames[Math.min(k.kare, a.frames.length - 1)], fw, fh);
    }
    kanvas.style.transform = `translate(${sol}px,${ust}px)` + (k.yon < 0 ? ` translateX(${fw}px) scaleX(-1)` : '');
  }
  // Pencere arkası: pencere dikdörtgeni tuvalden çıkarılır (evenodd delik). 2D aynalıysa yerel x ters çevrilir.
  const p = k.ortu && k.pr;
  if (p) {
    let a = p.l - sol, c = p.r - sol;
    if (el === kanvas && k.yon < 0) [a, c] = [fw - c, fw - a];
    el.style.clipPath = `path(evenodd, "M0 0H${fw}V${fh}H0Z M${a} ${p.t - ust}H${c}V${p.b - ust}H${a}Z")`;
  } else el.style.clipPath = '';
  sonKutu = { sol, ust, fw, fh };
  if (balon.classList.contains('acik')) balonKonum();
}

// Döngü: hareket ya da sürükleme varken rAF; yoksa yalnız animasyonun fps'i kadar setTimeout; tek kareli/bitmiş animasyonda hiç.
let rafVar = false, zaman = null, sonT = 0, hedef = null, surukleniyor = false;
function planla() {
  if (!gorunur || !S) return;
  if (hedef || surukleniyor) {
    if (!rafVar) { clearTimeout(zaman); zaman = null; rafVar = true; sonT = performance.now(); requestAnimationFrame(tik); }
    return;
  }
  if (rafVar || zaman) return;
  const a = anim();
  if (a.frames.length < 2 || (a.loop === false && k.kare >= a.frames.length - 1)) return;
  zaman = setTimeout(() => { zaman = null; tik(performance.now()); }, Math.max(0, k.kareT + 1000 / a.fps - performance.now()));
}
function tik(t) {
  rafVar = false;
  const dt = Math.min(0.05, (t - sonT) / 1000); sonT = t;
  const a = anim();
  if (a.frames.length > 1 && t - k.kareT >= 1000 / a.fps - 4) {
    k.kareT = t;
    if (k.kare < a.frames.length - 1) k.kare++; else if (a.loop !== false) k.kare = 0;
  }
  if (hedef) adim(dt);
  ciz(); planla();
}
// Sprite'ta olmayan animasyonun yedeği (ör. yer tutucuda fly/peek_side yok); ciddi modda varsa *_serious.
const YEDEK = { fly: 'walk', climb: 'walk', peek_side: 'peek', peek_top: 'idle', idle_serious: 'idle', speak_serious: 'speak' };
function animAyarla(ad) {
  if (ayar.ciddi && S.animations[ad + '_serious']) ad += '_serious';
  while (!S.animations[ad] && YEDEK[ad]) ad = YEDEK[ad];
  if (!S.animations[ad]) ad = 'idle';
  if (k.anim === ad) return;
  k.anim = ad; k.kare = 0; k.kareT = performance.now();
  Z?.setState(DURUM3[ad] || 'bosta'); Z?.speak(ad.startsWith('speak') ? 0.6 : 0);
  clearTimeout(zaman); zaman = null;
  ciz(); planla();
}

// ---------- gösterim kipi ----------
let bundleSoz = null;
const bundleYukle = () => (bundleSoz ??= new Promise((coz, red) => {
  const s = document.createElement('script');
  s.src = '3d/karakter.bundle.js'; s.onload = coz; s.onerror = () => { bundleSoz = null; red(new Error('3D modül yüklenemedi')); };
  document.head.append(s);
}));
async function kipAyarla(yeni) {
  if (yeni === '3d' && !Z) {
    try { await bundleYukle(); } catch (e) { console.error('[3d]', e.message); return; }
    if (Z) return;
    kip = '3d'; kanvas.hidden = true; kanvas3.hidden = false; kanvas3._fw = 0;
    kanvas3.style.width = kanvas3.style.height = gen() + 'px';
    Z = window.Kivil.createZepul({ canvas: kanvas3, varyant: 'yoldas', skin: ayar.ten || 'volt', state: DURUM3[k.anim] || 'bosta',
      dpr: Math.min(2, devicePixelRatio || 1), bloom: false, seffaf: true, zeminGolge: false, yakin: 1.15 });
  } else if (yeni !== '3d' && Z) {
    Z.destroy(); Z = null; kip = '2d'; kanvas3.hidden = true; kanvas.hidden = false; cizilen = '';
  }
  Z?.setSerious(!!ayar.ciddi);
  Z?.setSkin(ayar.ten || 'volt');
  Z?.setReducedMotion(!!ayar.azHareket);
  document.documentElement.classList.toggle('az', !!ayar.azHareket);
  const tenRenk = S?.sheet?.tints?.[ayar.ten]?.ten; if (tenRenk) document.documentElement.style.setProperty('--ten', tenRenk);
  ikonUret(); ciz();
}

// ---------- iptal edilebilir ilkel adımlar ----------
const bekleyenler = new Set();
function kayitli(kur) {
  return new Promise((coz, red) => {
    const b = { red, son: null };
    bekleyenler.add(b);
    b.son = kur((v) => { if (!bekleyenler.delete(b)) return; b.son?.(); coz(v); });
  });
}
function iptal() { const l = [...bekleyenler]; bekleyenler.clear(); for (const b of l) { b.son?.(); b.red(IPTAL); } }
const bekle = (ms) => kayitli((bit) => { const t = setTimeout(bit, ms); return () => clearTimeout(t); });
const oyna = (ad, ms) => { animAyarla(ad); return bekle(ms); };
const sonsuz = () => kayitli(() => null);

// Süzülme: yumuşak hızlanma/yavaşlama + hafif sinüs salınımı. Yerçekimi yok; her yere uçabilir.
function uc(x, y, o = {}) {
  return kayitli((bit) => {
    const d = Math.hypot(x - k.x, y - k.y);
    if (o.yon) k.yon = o.yon; else if (Math.abs(x - k.x) > 2) k.yon = Math.sign(x - k.x);
    hedef = { x0: k.x, y0: k.y, x, y, sure: Math.max(0.35, d / (o.hiz || (d > 500 ? HIZ * 2.3 : HIZ))), g: 0, bob: o.bob ?? 4, bit };
    const dx = Math.abs(x - k.x), dy = Math.abs(y - k.y);
    animAyarla(o.anim || (d > 500 ? 'fly' : dy > dx * 1.5 ? 'climb' : 'walk')); planla();
    return () => { if (hedef?.bit === bit) hedef = null; };
  });
}
function adim(dt) {
  const h = hedef;
  h.g += dt;
  const t = Math.min(1, h.g / h.sure), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  k.x = h.x0 + (h.x - h.x0) * e;
  k.y = h.y0 + (h.y - h.y0) * e + Math.sin(h.g * 6) * h.bob * Math.sin(Math.PI * t);
  if (t >= 1) { hedef = null; h.bit(); }
}

let nesil = 0;
function calistir(fn) {
  iptal();
  const n = ++nesil;
  fn().then(() => { if (n === nesil) sonraki(); }, (e) => {
    if (e === IPTAL) return;
    console.error('[davranış]', e);
    if (n === nesil) setTimeout(() => { if (n === nesil) sonraki(); }, 1000);
  });
}
function sonraki() { calistir(kuyruk.length && gorunur ? () => olay(kuyruk.shift()) : rutin); }

// ---------- yerler ----------
// Yer: { x, y (çapa), yon, anim, n:[nx,ny] (saklıysa çıkış yönü; [0,0] = görünür), pen (bağlanılacak pencere dikdörtgeni), ortu (pencereyle kırp), ad }
const sinirla = (v, a, b) => Math.max(a, Math.min(b, v));
const aynali = (yon) => kip === '2d' && yon < 0; // 2D sola bakarken kare aynalanır (çapa ters taraftan)
function capa(sol, ust, yon) { const o = olcu(); return { x: sol + (aynali(yon) ? o.fw - o.ax : o.ax), y: ust + o.ay }; }
const uygunPencere = (p) => p && p.v !== false && !p.i && !p.z;

function koseYeri() {
  const { fw, fh } = olcu(), sag = ayar.kose !== 'sol', yon = sag ? -1 : 1;
  return { ...capa(sag ? W() - fw - 16 : 16, H() - fh - 16, yon), yon, anim: 'idle', n: [0, 0], ad: 'kose' };
}
// Pencerelerin (bilinen: ön plan penceresi) kaplamadığı boş bir nokta; bulamazsa köşe.
function ortaYeri() {
  const { fw, fh } = olcu(), p = uygunPencere(aktif) ? aktif : null;
  for (let i = 0; i < 25; i++) {
    const sol = rnd(W() * 0.15, W() * 0.85 - fw), us = rnd(H() * 0.15, H() * 0.8 - fh), yon = Math.random() < 0.5 ? 1 : -1;
    if (!p || sol + fw < p.l || sol > p.r || us + fh < p.t || us > p.b) return { ...capa(sol, us, yon), yon, anim: 'idle', n: [0, 0], ad: 'orta' };
  }
  return koseYeri();
}
function pencereUstuYeri(p) { // pencerenin üst kenarına otur (görünür)
  const { fw } = olcu(), yon = Math.random() < 0.5 ? 1 : -1;
  return { x: capa(rnd(p.l + 8, Math.max(p.l + 8, p.r - fw - 8)), 0, yon).x, y: p.t, yon, anim: 'sit', n: [0, 0], pen: p, ad: 'pencere-ustu' };
}
// Pencerenin İÇ köşesi (görünür, pencereyle birlikte gider). Üst-sağ tercih: başlık çubuğunun (~32 px) altı,
// kaydırma çubuğundan uzak (sağdan 28 px). Büyütülmüş pencerede de olur.
function pencereIcYeri(p, kose = Math.random() < 0.6 ? 'ust-sag' : ['alt-sag', 'alt-sol', 'ust-sol'][Math.floor(Math.random() * 3)]) {
  const { fw, fh } = olcu(), l = Math.max(p.l, 0), r = Math.min(p.r, W()), t = Math.max(p.t, 0), b = Math.min(p.b, H());
  if (r - l < fw * 2.5 || b - t < fh * 2.5) return null;
  const sag = kose.endsWith('sag'), ust = kose.startsWith('ust'), yon = sag ? -1 : 1; // pencerenin içine bakar
  const sol = sag ? r - fw - 28 : l + 20, us = ust ? t + 32 + 16 : b - fh - 20;
  return { ...capa(sol, us, yon), yon, anim: 'sit', n: [0, 0], pen: p, ic: true, ad: 'pencere-ic-' + kose };
}
// Ekran yan kenarı, herhangi bir yükseklik: yalnız 'gor' oranı ekranda.
function kenarYeri(sag, us) {
  const { fw, fh, gor } = olcu(), yon = sag ? -1 : 1;
  return { ...capa(sag ? W() - gor * fw : -(1 - gor) * fw, sinirla(us, 0, H() - fh), yon), yon, anim: 'peek', n: [sag ? -1 : 1, 0], ad: 'kenar' };
}
// Ekranın altı (görev çubuğunun arkası): yalnız üst 'ust' oranı görünür.
function altYeri(x) {
  const { fw, fh, ust } = olcu(), yon = Math.random() < 0.5 ? 1 : -1;
  return { ...capa(sinirla(x - fw / 2, 0, W() - fw), H() - fh * ust, yon), yon, anim: 'idle', n: [0, -1], ad: 'alt' };
}
// Pencerenin arkası: gövde pencere dikdörtgeninde (kırpılır), kenarından yalnız kulak/gözler taşar.
function pencereYeri(p, kenar) {
  const { fw, fh, gor, ust } = olcu();
  let sol, us, yon, n;
  if (kenar === 'ust') {
    if (p.r - p.l < fw * 1.2 || p.t - fh * ust < 0) return null;
    sol = rnd(p.l, p.r - fw); us = p.t - fh * ust; yon = Math.random() < 0.5 ? 1 : -1; n = [0, -1];
  } else {
    if (p.b - p.t < fh * 1.3) return null;
    us = rnd(Math.max(p.t, 0), Math.min(p.b, H()) - fh);
    if (kenar === 'sol') { if (p.l - gor * fw < 0) return null; sol = p.l - gor * fw; yon = -1; n = [-1, 0]; }
    else { if (p.r + gor * fw > W()) return null; sol = p.r - (1 - gor) * fw; yon = 1; n = [1, 0]; }
  }
  return { ...capa(sol, us, yon), yon, anim: kenar === 'ust' ? 'peek_top' : 'peek_side', n, pen: p, ortu: true, ad: 'pencere-' + kenar };
}
// Görünür dinlenme: köşe, ön plan penceresinin iç köşesi ya da (sessiz değilse) üst kenarı.
function dinlenmeYeri() {
  const p = aktif && aktif.v !== false && !aktif.i ? aktif : null, s = [koseYeri()];
  if (p) { const ic = pencereIcYeri(p); if (ic) s.push(ic, ic); }
  if (p && !p.z && !ayar.sessiz && p.t > olcu().fh + 20) s.push(pencereUstuYeri(p));
  return s[Math.floor(Math.random() * s.length)];
}
function saklanmaYeri() {
  const s = [];
  if (uygunPencere(aktif)) for (const kn of ['sol', 'sag', 'ust']) { const y = pencereYeri(aktif, kn); if (y) s.push(y, y); } // pencere arkası 2 kat olası
  s.push(kenarYeri(true, rnd(H() * 0.1, H() * 0.85)), kenarYeri(false, rnd(H() * 0.1, H() * 0.85)), altYeri(rnd(W() * 0.1, W() * 0.9)));
  return s[Math.floor(Math.random() * s.length)];
}
// İmlece yakın ama üstünde değil; ekranın daha boş yarısına doğru.
function imlecYakini(im) {
  const { fw, fh } = olcu(), sag = im.x < W() / 2, yon = sag ? -1 : 1;
  const sol = sinirla(sag ? im.x + 60 : im.x - 60 - fw, 8, W() - fw - 8);
  let us = sinirla(im.y - fh * 0.6, 70, H() - fh - 8);
  if (im.x >= sol - 20 && im.x <= sol + fw + 20 && im.y >= us - 20 && im.y <= us + fh + 20) us = im.y > H() / 2 ? im.y - fh - 40 : im.y + 40;
  return { ...capa(sol, sinirla(us, 8, H() - fh - 8), yon), yon, anim: 'idle', n: [0, 0], ad: 'imlec' };
}

function baglan(p, ic = false) { k.pen = p.h; k.pr = p; k.ic = ic; Y.takip(p.h); }
function coz() { k.pen = 0; k.pr = null; k.ortu = false; k.ic = false; Y.takip(0); }
// Saklandığı yerden çıkış yönünde süzülerek çık (kırpma kalkar).
async function disariCik() {
  const y = k.sakli;
  if (!y) { if (k.pen) coz(); return; }
  const { fw, fh } = olcu();
  await uc(k.x + y.n[0] * fw * 0.9, k.y + y.n[1] * fh * 0.9, { hiz: 70, yon: k.yon, anim: 'walk', bob: 0 });
  k.sakli = null; coz();
}
async function yereGit(yer) {
  if (!yer) return;
  await disariCik();
  const { fw, fh } = olcu();
  if (yer.n[0] || yer.n[1]) { // önce kenarın dışına, sonra yavaşça içeri kay
    await uc(yer.x + yer.n[0] * fw * 0.9, yer.y + yer.n[1] * fh * 0.9);
    if (yer.pen) { baglan(takipBilgi?.h === yer.pen.h ? takipBilgi : yer.pen); k.ortu = !!yer.ortu; }
    await uc(yer.x, yer.y, { hiz: 45, yon: yer.yon, anim: yer.anim, bob: 0 });
    k.sakli = yer;
  } else {
    await uc(yer.x, yer.y);
    if (yer.pen) baglan(takipBilgi?.h === yer.pen.h ? takipBilgi : yer.pen, !!yer.ic);
  }
  k.yon = yer.yon;
  animAyarla(yer.anim === 'idle' ? DINLENME[durum] || 'idle' : yer.anim);
}

async function uyu() { animAyarla(k.sakli ? k.sakli.anim : 'sleep'); await sonsuz(); }

// ---------- varsayılan rutin ----------
// Görünürken bir süre köşede/pencere üstünde süzülür, sonra saklanır; saklıyken seyrek (sessiz: 3–6 dk) kısa bir
// orta-ekran süzülüşü yapıp yeniden saklanır. Çalışıyor/bekliyor/hata durumunda köşede görünür kalır.
async function rutin() {
  if (uykuda) return uyu();
  if (ayar.dolas === false && !bekleyen.length) { // dolaşma kapalı: en yakın yan kenara, bulunduğu yükseklikte sin; yalnız olay (bildirim/soru) çıkarır
    if (k.sakli?.ad !== 'kenar') await yereGit(kenarYeri(k.x > W() / 2, k.y - olcu().ay));
    return sonsuz();
  }
  for (;;) {
    const d = bekleyen.length ? 'bekliyor' : durum;
    if (d !== 'bosta') {
      const kose = koseYeri(); // bekleyen soru: görünür köşede bekler (dolaşma kapalıyken de)
      if (k.sakli || (bekleyen.length && Math.hypot(k.x - kose.x, k.y - kose.y) > 4)) await yereGit(kose);
      animAyarla(DINLENME[d] || 'idle');
      await bekle(30e3);
      continue;
    }
    if (!k.sakli) {
      await yereGit(dinlenmeYeri());
      await bekle(ayar.sessiz ? 20e3 : rnd(15e3, 40e3));
      await yereGit(saklanmaYeri());
    }
    await bekle(ayar.sessiz ? rnd(180e3, 360e3) : rnd(30e3, 60e3));
    await yereGit(ortaYeri());
    await bekle(rnd(3e3, 6e3));
    await yereGit(saklanmaYeri());
  }
}

// ---------- olay: süzülerek çık, imlecin yanına gel, balon, tık/20 sn (sure) bekle, geri dön ----------
// Soru: balon ~20 sn açık kalır (sure 0 = süresiz: hep bekletilir, kendiliğinden düşmez); süresi (m.bitis) dolmadıysa küçülerek kapanır ve bekleyen olur. m.yerinde: bekleyen
// soru Pamuk'a tıklanarak yeniden açıldı (imlece gitmez). Düşürülen soru (main 'dusur') sessizce kapanır.
// Takip penceresi: düğmeyle cevaptan sonra ~2,5 sn yerinde kalır; bu sırada yeni soru gelirse (kanca sıradakini hemen
// yollar) balon kapanmadan içerik yerinde değişir.
const BEKLET = Symbol('beklet'), DUSTU = Symbol('dustu');
let balonCoz = null, imlecSon = null, simdiki = null;
async function olay(m) {
  olayda = true; simdiki = m;
  let cevaplandi = false;
  try {
    const im = m.im || (await Y.imlec());
    imlecSon = im;
    let hata = m.alt === 'hata', soru = m.tip === 'soru';
    if (m.yerinde) await disariCik();
    else { await yereGit(imlecYakini(im)); await oyna(hata ? 'error' : 'wave', 1100); }
    if (m.dustu) { cevaplandi = true; return; }
    balonGoster(m);
    let c;
    for (;;) {
      animAyarla(soru ? 'think' : hata ? 'error' : 'speak');
      const kalan = !soru ? (m.sure ?? 20) * 1000 : m.sure === 0 ? Infinity : m.bitis ? m.bitis - Date.now() : 20000;
      const acik = soru ? Math.min(kalan, 20000) : kalan;
      c = await kayitli((bit) => {
        balonCoz = bit;
        const t1 = setTimeout(() => { animAyarla(hata ? 'error' : 'wait'); if (soru) balon.classList.add('bekliyor'); }, 1600);
        const t2 = setTimeout(() => bit(acik < kalan ? BEKLET : null), Math.max(0, acik));
        return () => { clearTimeout(t1); clearTimeout(t2); balonCoz = null; };
      });
      cevaplandi = true;
      if (c === BEKLET || c === DUSTU) {
        if (c === BEKLET) { m.yerinde = true; bekleyen.unshift(m); }
        await balonKucul();
        return;
      }
      Y.cevap(m.id, c);
      if (c) { balonSecildi(); await bekle(azHareket() ? 0 : 150); } // patlamadan hemen önce küçük "✓"
      const s = soru && c ? await takipSorusu() : null;
      if (!s) break;
      if (!azHareket()) { balon.classList.add('degis'); await bekle(160 * yavas()); } // eski içerik söner, yenisi belirir
      m = simdiki = s; cevaplandi = false; hata = m.alt === 'hata'; soru = true;
      balonGoster(m);
    }
    await balonKapat();
    if (c) await oyna(hata ? 'error' : 'wave', 900); // mutlu tepki
    if (soru && m.yerinde && bekleyen.length) kuyruk.unshift(bekleyen.shift()); // sıradaki bekleyen soru
  } catch (e) {
    if (e === IPTAL && !cevaplandi) (m.yerinde ? bekleyen : kuyruk).unshift(m); // sürükleme kesti: sonra yeniden göster
    throw e;
  } finally { balonGizle(); olayda = false; simdiki = null; }
}

// Cevaptan sonra ~2,5 sn kuyrukta soru bekler (takip penceresi); gelirse kuyruktan alır.
async function takipSorusu() {
  for (let t = 0; t <= 2500; t += 100) {
    const i = kuyruk.findIndex((x) => x.tip === 'soru');
    if (i >= 0) return kuyruk.splice(i, 1)[0];
    await bekle(100);
  }
  return null;
}

// Küçük SVG ikonlar (emoji yok).
const IKON = {
  soru: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.6"/><path d="M6.2 6.3a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.3v.3"/><circle cx="8" cy="11.6" r=".5" fill="currentColor"/></svg>',
  bilgi: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.6"/><path d="M8 7.4v4"/><circle cx="8" cy="5" r=".5" fill="currentColor"/></svg>',
  uyari: '<svg viewBox="0 0 16 16"><path d="M8 2.2 14.3 13.3H1.7Z"/><path d="M8 6.4v3.2"/><circle cx="8" cy="11.4" r=".5" fill="currentColor"/></svg>',
  tamam: '<svg viewBox="0 0 16 16"><path d="M4.4 8.4 6.9 10.8 11.6 5.6"/></svg>',
};
const balonIkon = document.getElementById('bi');
const azHareket = () => !!ayar.azHareket || matchMedia('(prefers-reduced-motion: reduce)').matches;

function balonGoster(m) {
  balon.className = '';
  const tur = m.tip === 'soru' ? 'soru' : m.alt === 'hata' ? 'uyari' : 'bilgi';
  balon.classList.add(tur);
  balonIkon.innerHTML = IKON[tur];
  balonKaynak.textContent = m.etiket || '';
  balonKaynak.dataset.k = m.kaynak === 'zepul' || m.kaynak === 'claude' ? m.kaynak : '';
  // metin: cümle cümle yumuşakça belirir (harf harf değil)
  balonMetin.replaceChildren(...(m.metin.match(/[^.!?]+[.!?]*\s*/g) || [m.metin]).map((p, i) => {
    const s = document.createElement('span'); s.textContent = p; s.style.animationDelay = `calc(${90 + i * 140}ms * var(--yavas))`; return s;
  }));
  balonDugme.replaceChildren();
  balonDugme.classList.toggle('cok', m.tip === 'soru' && m.secenekler.length > 2);
  balonDugme.classList.toggle('uzun', m.tip === 'soru' && m.secenekler.some((t) => t.length > 20)); // uzun etiket: her düğme kendi satırında
  if (m.tip === 'soru') {
    (m.secenekler.length ? m.secenekler : ['Onayla', 'Reddet']).forEach((t, i) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.animationDelay = `calc(${160 + i * 40}ms * var(--yavas))`; // sırayla belirir
      b.addEventListener('click', (e) => { e.stopPropagation(); dugmeSec(b, e); });
      balonDugme.append(b);
    });
  }
  balon.classList.add('acik');
  ciz();
}
function dugmeSec(b, e) {
  if (!balonCoz) return;
  const r = b.getBoundingClientRect(), d = document.createElement('span');
  d.className = 'dalga';
  d.style.left = `${(e?.clientX ?? r.left + r.width / 2) - r.left}px`; d.style.top = `${(e?.clientY ?? r.top + r.height / 2) - r.top}px`;
  b.append(d);
  for (const x of balonDugme.children) x.classList.add(x === b ? 'secili' : 'soluk');
  balonCoz(b.textContent);
}
function balonSecildi() { balon.classList.remove('bekliyor', 'soru', 'uyari', 'bilgi'); balon.classList.add('tamam'); balonIkon.innerHTML = IKON.tamam; }
// Balon patlar: hafif şişme, gövde kaybolur, 6–8 parçacık saçılıp söner, ince halka dalgası. Az harekette anında.
const yavas = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--yavas')) || 1;
function balonKapat() {
  if (!balon.classList.contains('acik') || azHareket()) return Promise.resolve();
  balon.classList.add('patla');
  return new Promise((coz) => setTimeout(() => {
    const govde = document.getElementById('bk'), kutu = balon.getBoundingClientRect(), g = govde.getBoundingClientRect();
    const ox = g.left - kutu.left, oy = g.top - kutu.top, cx = ox + g.width / 2, cy = oy + g.height / 2;
    const halka = document.createElement('div');
    halka.className = 'halka';
    Object.assign(halka.style, { left: ox + 'px', top: oy + 'px', width: g.width + 'px', height: g.height + 'px' });
    balon.append(halka);
    const n = 6 + Math.floor(Math.random() * 3), zemin = getComputedStyle(govde).backgroundColor;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span'), boy = 5 + Math.random() * 5, aci = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const rx = Math.cos(aci), ry = Math.sin(aci), uzak = 18 + Math.random() * 26;
      p.className = 'parca';
      Object.assign(p.style, {
        left: cx + rx * g.width * 0.38 - boy / 2 + 'px', top: cy + ry * g.height * 0.38 - boy / 2 + 'px', width: boy + 'px', height: boy + 'px',
        background: i % 2 ? 'var(--ten)' : 'color-mix(in srgb, var(--ten) 30%, ' + zemin + ')', boxShadow: '0 0 0 1px var(--ince)',
      });
      p.style.setProperty('--dx', rx * uzak + 'px'); p.style.setProperty('--dy', ry * uzak + 'px');
      p.style.setProperty('--sure', (220 + Math.random() * 60) * yavas() + 'ms');
      balon.append(p);
    }
    balon.classList.add('patladi');
    irkil();
    setTimeout(coz, 285 * yavas());
  }, 90 * yavas()));
}
function balonKucul() { // patlamasız kapanış (soru bekletildi / düştü)
  if (!balon.classList.contains('acik') || azHareket()) return Promise.resolve();
  balon.classList.add('kucul');
  return new Promise((coz) => setTimeout(coz, 240 * yavas()));
}
function irkil() { // patlamaya küçük irkilme
  const el = kip === '3d' ? kanvas3 : kanvas;
  el.classList.remove('irkil'); void el.offsetWidth; el.classList.add('irkil');
  setTimeout(() => el.classList.remove('irkil'), 300 * yavas());
}
function balonGizle() { balon.className = ''; balon.querySelectorAll('.parca, .halka').forEach((e) => e.remove()); }
// Konum: karakterin üstünde; sığmazsa altında; imlecin üstüne gelirse yana. Kuyruk karaktere bakar.
function balonKonum() {
  const { sol, ust, fw, fh } = sonKutu, bw = balon.offsetWidth, bh = balon.offsetHeight, cx = sol + fw / 2;
  let x = Math.max(6, Math.min(W() - bw - 6, cx - bw / 2));
  let y = ust + fh * 0.1 - bh - 10, alt = false;
  if (y < 6) { y = ust + fh * 0.95 + 10; alt = true; }
  const im = imlecSon;
  if (im && im.x >= x - 8 && im.x <= x + bw + 8 && im.y >= y - 8 && im.y <= y + bh + 8) { // imleç altında kalır: karakterin yanına al
    x = im.x < cx ? Math.min(W() - bw - 6, sol + fw + 8) : Math.max(6, sol - bw - 8);
  }
  balon.classList.toggle('alt', alt);
  balon.style.setProperty('--kx', `${Math.max(18, Math.min(bw - 18, cx - x))}px`);
  balon.style.transform = `translate(${x}px,${y}px)`;
}
balon.addEventListener('click', () => { if (!balonDugme.children.length) balonCoz?.('tamam'); });

// ---------- fare: yalnız sprite/balon üstündeyken tıklama alınır ----------
let fareUstunde = false, bas = null;
function balonIcinde(x, y) {
  if (!balon.classList.contains('acik')) return false;
  const r = balon.getBoundingClientRect();
  return x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4;
}
function spriteIcinde(x, y) {
  if (!sonKutu || !gorunur) return false;
  const { sol, ust, fw, fh } = sonKutu, p = k.ortu && k.pr;
  if (x < sol || x >= sol + fw || y < ust || y >= ust + fh) return false;
  if (p && x >= p.l && x <= p.r && y >= p.t && y <= p.b) return false; // pencerenin arkasındaki kısım: tıklama pencereye
  if (kip === '3d') return ((x - sol - fw / 2) / (fw * 0.34)) ** 2 + ((y - ust - fh * 0.5) / (fh * 0.34)) ** 2 <= 1; // WebGL tuvali okunamaz: gövde elipsi
  const lx = k.yon < 0 ? sol + fw - x : x - sol, dpr = devicePixelRatio || 1;
  return ctx.getImageData(Math.floor(lx * dpr), Math.floor((y - ust) * dpr), 1, 1).data[3] > 20; // saydam piksel tıklamayı geçirir
}
addEventListener('mousemove', (e) => {
  if (bas) {
    if (!surukleniyor && Math.hypot(e.clientX - bas.x, e.clientY - bas.y) > 5) surukleBasla();
    if (surukleniyor) { k.x = sinirla(e.clientX - bas.dx, 0, W()); k.y = sinirla(e.clientY - bas.dy, 0, H() + yuk() * 0.3); ciz(); }
    return;
  }
  const u = spriteIcinde(e.clientX, e.clientY) || balonIcinde(e.clientX, e.clientY);
  if (u !== fareUstunde) { fareUstunde = u; Y.fare(u); }
});
addEventListener('mousedown', (e) => {
  if (e.button === 0 && spriteIcinde(e.clientX, e.clientY)) bas = { x: e.clientX, y: e.clientY, dx: e.clientX - k.x, dy: e.clientY - k.y };
});
addEventListener('mouseup', () => {
  if (!bas) return;
  bas = null;
  if (surukleniyor) { // bırakıldığı yerde kalır; bir süre sonra rutin onu yeniden saklar
    surukleniyor = false;
    calistir(async () => { animAyarla('idle'); await bekle(ayar.sessiz ? 30e3 : 15e3); });
    return;
  }
  if (olayda) { if (simdiki?.tip !== 'soru') balonCoz?.('tamam'); } // soru yalnız düğmeyle cevaplanır
  else if (bekleyen.length) bekleyenAc();
  else calistir(async () => { await disariCik(); await oyna('wave', 1000); await bekle(5000); });
});
function bekleyenAc() { if (!olayda && S && bekleyen.length) { kuyruk.unshift(bekleyen.shift()); sonraki(); } }
addEventListener('contextmenu', (e) => { e.preventDefault(); if (fareUstunde) Y.menu(); });
function surukleBasla() {
  iptal(); nesil++; // çalışan davranışı durdur; bırakınca yenisi başlar
  surukleniyor = true;
  k.sakli = null; coz();
  animAyarla('wait'); planla();
}

// ---------- ana süreçten gelenler ----------
function takipBekle(h) { // verilen hwnd'nin dikdörtgeni (test için; normalde ön plan penceresi kullanılır)
  Y.takip(h);
  return kayitli((bit) => {
    takipBekleyen = () => { if (takipBilgi && takipBilgi.h === h) bit(takipBilgi); else if (takipIstenen === h && !takipBilgi) bit(null); };
    const t = setTimeout(() => bit(null), 3000);
    return () => { clearTimeout(t); takipBekleyen = null; };
  });
}
Y.on('pencere', (m) => {
  aktif = m.aktif; takipIstenen = m.istenen;
  const eski = takipBilgi;
  takipBilgi = m.takip;
  takipBekleyen?.();
  if (!k.pen || takipIstenen !== k.pen) return;
  const p = m.takip;
  if (!p || p.h !== k.pen || !p.v || p.i || (p.z && !k.ic)) { // kapandı/küçüldü/büyüdü (iç köşede büyütme sorun değil): kırpma kalkar, yumuşakça yeni yer
    k.sakli = null; coz(); ciz();
    if (!olayda && !surukleniyor) calistir(rutin);
    return;
  }
  k.pr = p;
  if (k.ic && eski && eski.h === p.h && (p.r - p.l !== eski.r - eski.l || p.b - p.t !== eski.b - eski.t)) { // boyut değişti: köşeye yeniden süzül
    if (!olayda && !surukleniyor && !hedef) calistir(async () => { await yereGit(pencereIcYeri(p, 'ust-sag') || koseYeri()); await bekle(rnd(15e3, 30e3)); });
    return;
  }
  if (eski && eski.h === p.h) { // taşındı: birlikte kay (süzülme sürüyorsa yolu da kaydır)
    const dx = p.l - eski.l, dy = p.t - eski.t;
    if (hedef) { hedef.x0 += dx; hedef.x += dx; hedef.y0 += dy; hedef.y += dy; }
    k.x += dx; k.y += dy;
    const o = olcu();
    if (!hedef && (k.y - o.ay > H() - o.fh * 0.3 || k.x < 0 || k.x > W())) { // pencereyle ekran dışına taşındı: yeni yer bul
      k.sakli = null; coz(); ciz();
      if (!olayda && !surukleniyor) calistir(rutin);
      return;
    }
  }
  ciz();
});
Y.on('olay', (m) => { kuyruk.push(m); if (!olayda && S) sonraki(); });
Y.on('dusur', (id) => { // soran vazgeçti / başka yerden cevaplandı / süre doldu: sessizce kaldır
  for (const l of [kuyruk, bekleyen]) { const i = l.findIndex((x) => x.id === id); if (i >= 0) l.splice(i, 1); }
  if (simdiki?.id === id) { simdiki.dustu = true; balonCoz?.(DUSTU); }
});
Y.on('gorunur', (g) => {
  gorunur = g;
  if (g) { k.kareT = performance.now(); planla(); const l = [...askida]; askida.clear(); l.forEach((cb) => requestAnimationFrame(cb)); return; }
  clearTimeout(zaman); zaman = null;
  if (fareUstunde) { fareUstunde = false; Y.fare(false); }
});
Y.on('uyku', (u) => { uykuda = u; if (S && !olayda) calistir(rutin); });
Y.on('durum', (d) => { durum = d; if (S && !olayda) calistir(rutin); });
Y.on('ayar', async (a) => {
  ayar = a; cizilen = '';
  await kipAyarla(a.gosterim === '3d' ? '3d' : '2d'); // canlı geçiş
  if (S && !olayda) calistir(rutin);
});
Y.on('komut', ({ ad, hwnd }) => {
  // Balon test kancaları: çalışan olayı kesmeden doğrudan uygulanır.
  if (ad === 'yavas') { document.documentElement.style.setProperty('--yavas', String(hwnd || 1)); return; }
  if (ad === 'balon-hover') { balonDugme.firstElementChild?.classList.add('hover'); return; }
  if (ad === 'balon-sec') { const b = balonDugme.firstElementChild; if (b) dugmeSec(b); return; }
  if (ad === 'soru-ac') { bekleyenAc(); return; } // tepsi "Bekleyen soru" maddesi
  const pencere = async () => (hwnd ? await takipBekle(hwnd) : aktif);
  const kal = (ms = 15000) => bekle(ms);
  const nokta = hwnd > 0 ? { x: Math.floor(hwnd / 10000), y: hwnd % 10000 } : null; // test: hwnd alanında x*10000+y (DIP)
  const testler = {
    orta: async () => { const o = olcu(); await yereGit(nokta ? { ...capa(nokta.x - o.fw / 2, nokta.y - o.fh / 2, 1), yon: 1, anim: 'idle', n: [0, 0] } : ortaYeri()); await kal(); },
    balon: async () => { await olay({ id: 0, tip: 'soru', metin: 'Ajan işini bitirdi. Sonucu açayım mı?', secenekler: ['Aç', 'Sonra'], im: nokta || (await Y.imlec()) }); },
    kose: async () => { await yereGit(koseYeri()); await kal(); },
    ic: async () => { const p = await pencere(); if (p && p.v !== false && !p.i) { await yereGit(pencereIcYeri(p, 'ust-sag')); await kal(); } },
    tirman: async () => { const p = await pencere(); if (uygunPencere(p)) { aktif = p; await yereGit(pencereUstuYeri(p)); await kal(); } },
    batir: async () => { const p = await pencere(); if (!uygunPencere(p)) return; aktif = p;
      await yereGit(pencereYeri(p, 'sol') || pencereYeri(p, 'ust') || pencereYeri(p, 'sag')); await kal(); },
    saklan: async () => { await yereGit(kenarYeri(k.x > W() / 2, rnd(H() * 0.2, H() * 0.7))); await kal(); },
    alt: async () => { await yereGit(altYeri(k.x)); await kal(); },
    uyku: async () => { await disariCik(); animAyarla('sleep'); await kal(); },
  };
  if (S && testler[ad]) calistir(testler[ad]);
});
Y.on('sprite', async ({ taban, sheet, ikon, svgMetin }) => {
  try { S = await spriteYukle(taban, sheet, svgMetin); S.sheet = sheet; } catch (e) { console.error('[sprite]', e.message); return; }
  spriteTaban = taban; spriteIkon = ikon || {};
  const tenRenk = sheet.tints?.[ayar.ten]?.ten; if (tenRenk) document.documentElement.style.setProperty('--ten', tenRenk);
  cizilen = '';
  ikonUret();
  if (!k.x) { const y = koseYeri(); k.x = y.x; k.y = y.y; k.yon = y.yon; }
  calistir(rutin);
});
addEventListener('resize', () => { if (S && !olayda) { k.sakli = null; coz(); calistir(rutin); } });

// Tepsi ikonları + balon avatarı. Öncelik: sprite klasöründe icons/tray.png & icons/avatar.png;
// yoksa Pamuk (3D kip ya da 'pamuk' sprite) için geçici 3d/pamuk-32/64.png; o da değilse sprite'ın idle karesi.
let ikonSira = 0;
async function ikonUret() {
  const sira = ++ikonSira;
  const pamuk = kip === '3d' || /pamuk/i.test(spriteTaban);
  const avatar = spriteIkon.avatar || (pamuk ? '3d/pamuk-64.png' : '');
  balonAvatar.hidden = !avatar; if (avatar) balonAvatar.src = avatar;
  let img = null;
  const tepsi = spriteIkon.tepsi || (pamuk ? '3d/pamuk-32.png' : '');
  if (tepsi) try { img = await resimYukle(tepsi); } catch {}
  if (sira !== ikonSira || (!img && !S)) return;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), o = {};
  for (const [d, renk] of Object.entries({ bosta: '#43a047', calisiyor: '#1e88e5', bekliyor: '#fb8c00', hata: '#e53935' })) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 32, 32);
    if (img) g.drawImage(img, 0, 0, 32, 32);
    else { g.translate(-7, -8); S.ciz(g, S.animations.idle.frames[0], 46, 46); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.beginPath(); g.arc(25, 25, 6, 0, Math.PI * 2); g.fillStyle = renk; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
    o[d] = c.toDataURL();
  }
  Y.ikonlar(o);
}

Y.hazir();
