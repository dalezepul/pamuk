// Pamuk (Zepul yoldaşı) 2D sprite üreteci: SVG kareler + sheet.json + pamuk.master.svg + ikon SVG'leri + onizleme.html
//   node kare-uret.mjs [--ten volt|aura|auraGece] [çıktı klasörü ...]      (varsayılan çıktı: bu dosyanın klasörü)
// Sözleşme (zepul-yoldas/sprites/placeholder): kareler SAĞA bakar; çapa = alt-orta; climb: duvar karenin SAĞ kenarında;
// peek: karakter solda saklı, yalnız sağdaki %40 (x ≥ 77) görünür. viewBox 128×128; PNG sayfa @2x 256 px hücre.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const tenAd = argv.includes('--ten') ? argv[argv.indexOf('--ten') + 1] : 'volt';
const cikti = argv.filter((a, i) => a !== '--ten' && argv[i - 1] !== '--ten');
if (!cikti.length) cikti.push(dirname(fileURLToPath(import.meta.url)));

// ---------- kimlik ----------
export const TENLER = { // ten = ışık/vurgu rengi (iris halkası, kulak içi, karın ışığı, rim); vurgu = ikinci renk (düşünüyor)
  volt: { ten: '#4FB3FF', vurgu: '#8A4DFF', dolgu: '#7fa6ff' },
  aura: { ten: '#1FC9BD', vurgu: '#9B6DFF', dolgu: '#bfe6ff' },
  auraGece: { ten: '#35E6A0', vurgu: '#8E5BFF', dolgu: '#6fe0b8' },
};
export const DURUM_RENK = { bosta: 'var(--ten)', dusunuyor: 'var(--vurgu)', onay: '#FFC24D', hata: '#FF3B3B', uyku: 'var(--ten)', ciddi: '#4FB3FF' };
const R = { govde: '#f3eee8', govdeAcik: '#ffffff', govdeGolge: '#cdc1b6', govdeKoyu: '#b9ada2', kontur: '#2b2530', kenar: '#cdb9ab',
  goz: '#14101a', gozUst: '#2d2538', allik: '#ff9fb4', agiz: '#3b2433', hale: '#ffffff', ekran: '#1b2340' };
const ten = TENLER[tenAd] || TENLER.volt;
const f = (n) => +(+n).toFixed(2);

// ---------- geometri (128 viewBox; gövde merkezi 64,80; r 36; taban 116; çapa 64,122) ----------
const CX = 64, CY = 80, RG = 36, TABAN = CY + RG;
const KULAK = [[-27, -30], [27, -30]]; // merkeze göre kulak merkezleri
const KULAK_TABAN = [[-21, -23], [21, -23]]; // kulak dönme noktası
const GOZ = [[-14, -8], [14, -8]];
const KOL = [[-31, 6], [31, 6]]; // kol pivotları (merkeze göre)

const P0 = {
  dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, // gövde: taban noktasına göre squash–stretch, dönüş merkez
  kulak: 0, // + : kulaklar dışa/geriye yatar (zıplama gecikmesi); − : dikleşir
  bakis: [0, 0], kapak: 0, egim: 0, // kapak 0 açık…1 kapalı; egim + : iç uç aşağı (kararlı/ciddi), − : iç uç yukarı (merak)
  agiz: 'gulumse', // gulumse | duz | o | O | uzgun | yok
  kol: [0, 0], // dışa açı (0 aşağı sarkık, 90 yana, 160 yukarı; − içe)
  kolUzun: 0, // kolların aşağı kayması (oturma)
  karin: .9, durum: 'bosta', // karın ışığı yoğunluğu + durum rengi
  allik: .5, yuz: [0, 0], // yüz ofseti (peek: yüz kenara döner)
  golge: true, ek: '', yuzOnde: false,
  iz: null, // karın ışığı izi: { n, yon: [x, y] } — süzülürken arkada kalan soluk puflar
};

const stil = `:root{--ten:${ten.ten};--vurgu:${ten.vurgu};--dolgu:${ten.dolgu}}.t{fill:var(--ten)}.ts{stroke:var(--ten)}.v{fill:var(--vurgu)}.ds{stroke:var(--dolgu)}.gs{stop-color:var(--ten)}.vs{stop-color:var(--vurgu)}`;
const defs = (durumRenk) => `<defs>
<radialGradient id="gv" cx=".36" cy=".28" r=".82"><stop offset="0" stop-color="${R.govdeAcik}"/><stop offset=".48" stop-color="${R.govde}"/><stop offset=".84" stop-color="${R.govdeGolge}"/><stop offset="1" stop-color="${R.govdeKoyu}"/></radialGradient>
<radialGradient id="gk" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${R.govdeAcik}"/><stop offset=".6" stop-color="${R.govde}"/><stop offset="1" stop-color="${R.govdeGolge}"/></radialGradient>
<linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${R.gozUst}"/><stop offset="1" stop-color="${R.goz}"/></linearGradient>
<radialGradient id="gb"><stop offset="0" stop-color="${durumRenk}" stop-opacity=".95"/><stop offset=".55" stop-color="${durumRenk}" stop-opacity=".55"/><stop offset="1" stop-color="${durumRenk}" stop-opacity="0"/></radialGradient>
<radialGradient id="ga"><stop offset="0" stop-color="${R.allik}" stop-opacity=".9"/><stop offset="1" stop-color="${R.allik}" stop-opacity="0"/></radialGradient>
<filter id="h" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
<feMorphology in="SourceAlpha" operator="dilate" radius="1.3" result="d1"/><feFlood flood-color="${R.kontur}" flood-opacity=".78" result="c1"/><feComposite in="c1" in2="d1" operator="in" result="o1"/>
<feMorphology in="SourceAlpha" operator="dilate" radius="3.2" result="d2"/><feGaussianBlur in="d2" stdDeviation=".9" result="d2b"/><feFlood flood-color="${R.hale}" flood-opacity=".55" result="c2"/><feComposite in="c2" in2="d2b" operator="in" result="o2"/>
<feMerge><feMergeNode in="o2"/><feMergeNode in="o1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

// --- parçalar (sembol içerikleri; hepsi kendi yerel orijininde) ---
const kapsul = (uz, w) => `<path d="M${f(-w / 2)} 0 a${f(w / 2)} ${f(w / 2)} 0 0 1 ${w} 0 v${uz} a${f(w / 2)} ${f(w / 2)} 0 0 1 ${-w} 0 z"/>`;
const SEMBOL = {
  govde: `<circle r="${RG}" fill="url(#gv)"/><ellipse cx="-17" cy="-25" rx="9.5" ry="5.5" transform="rotate(-38 -17 -25)" fill="#fff" opacity=".9"/>` +
    `<path d="M${f(RG * Math.cos(-.35))} ${f(RG * Math.sin(-.35))} A${RG} ${RG} 0 0 1 ${f(RG * Math.cos(1.35))} ${f(RG * Math.sin(1.35))}" fill="none" class="ts" stroke-width="3" stroke-linecap="round" opacity=".55"/>` +
    `<path d="M${f(RG * Math.cos(2.5))} ${f(RG * Math.sin(2.5))} A${RG} ${RG} 0 0 1 ${f(RG * Math.cos(3.4))} ${f(RG * Math.sin(3.4))}" fill="none" class="ds" stroke-width="2" stroke-linecap="round" opacity=".35"/>`,
  kulak: `<circle r="11" fill="url(#gk)"/><circle r="6.2" class="t" opacity=".8"/><circle cx="-1.5" cy="-1.5" r="2.2" fill="#fff" opacity=".55"/>`,
  kol: `<g fill="url(#gk)" stroke="${R.govdeGolge}" stroke-width="1">${kapsul(11, 8.5)}</g><circle cy="13.5" r="5" fill="url(#gk)" stroke="${R.govdeGolge}" stroke-width="1"/>`,
  gozKure: `<circle r="12" fill="${R.kenar}"/><circle r="11" fill="url(#ge)"/>`,
  iris: `<circle r="6.3" fill="none" class="ts" stroke-width="2.4"/><circle r="5" class="t" opacity=".16"/>`,
  parilti: `<ellipse cx="-3.6" cy="-3.9" rx="3.7" ry="2.6" transform="rotate(-25 -3.6 -3.9)" fill="#fff"/><circle cx="3.6" cy="3.2" r="1.5" fill="#fff" opacity=".9"/>`,
  karin: `<ellipse rx="15" ry="8.5" fill="url(#gb)"/>`,
  allik: `<ellipse rx="7" ry="4" fill="url(#ga)"/>`,
};
const sembol = (ad, x, y, ek = '') => `<g transform="translate(${f(x)} ${f(y)})${ek}">${SEMBOL[ad]}</g>`;

function goz(i, p, id) {
  const [gx, gy] = [GOZ[i][0] + p.yuz[0], GOZ[i][1] + p.yuz[1]];
  const [bx, by] = p.bakis, ic = i === 0 ? 1 : -1; // iç taraf yönü (+x sol göz için sağ)
  let s = `<g transform="translate(${f(gx)} ${f(gy)})">${SEMBOL.gozKure}`;
  if (p.kapak < .95) s += `<g transform="translate(${f(bx * .55)} ${f(by * .55)})">${SEMBOL.iris}</g><g transform="translate(${f(bx * .25)} ${f(by * .25)})">${SEMBOL.parilti}</g>`;
  if (p.kapak > 0 && p.kapak < .95) { // üst kapak: gövde renginde, kenar çizgili; iç uç eğimle alçalır/yükselir
    const h = -12 + 24 * p.kapak, dis = h - p.egim * 5, icY = h + p.egim * 5;
    const xd = -13 * ic, xi = 13 * ic;
    s += `<clipPath id="${id}"><circle r="12"/></clipPath><g clip-path="url(#${id})"><path d="M${xd} -14 H${xi} V${f(icY)} L${xd} ${f(dis)} Z" fill="${R.govde}"/><line x1="${xd}" y1="${f(dis)}" x2="${xi}" y2="${f(icY)}" stroke="${R.kenar}" stroke-width="1.8"/></g>`;
  }
  if (p.kapak >= .95) s += `<circle r="12" fill="${R.govde}"/><path d="M-8 -1 q8 6 16 0" fill="none" stroke="${R.agiz}" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>`;
  return s + '</g>';
}
function agiz(p) {
  const [mx, my] = [p.yuz[0], 6 + p.yuz[1]];
  const a = { gulumse: `<path d="M-4 0 q4 3.4 8 0" fill="none"/>`, duz: `<path d="M-3.5 .5 h7" fill="none"/>`, o: `<ellipse cy="1" rx="2.2" ry="2.8" fill="${R.agiz}"/>`,
    O: `<ellipse cy="1.5" rx="3.4" ry="4.2" fill="${R.agiz}"/>`, uzgun: `<path d="M-4 2 q4 -3.4 8 0" fill="none"/>`, yok: '' }[p.agiz];
  return `<g transform="translate(${f(mx)} ${f(my)})" stroke="${R.agiz}" stroke-width="1.9" stroke-linecap="round">${a}</g>`;
}

export function kare(o = {}) {
  const p = { ...P0, ...o };
  const durumRenk = DURUM_RENK[p.durum] || p.durum;
  const id = Math.random().toString(36).slice(2, 7);
  const iz = p.iz ? [...Array(p.iz.n)].map((_, i) => `<ellipse cx="${f(CX + p.dx + p.iz.yon[0] * (12 + i * 11))}" cy="${f(TABAN - 14 + p.dy + p.iz.yon[1] * (10 + i * 10))}" rx="${f(9 - i * 2)}" ry="${f(5.5 - i * 1.2)}" fill="${durumRenk}" opacity="${f(.42 - i * .11)}"/>`).join('') : '';
  const golge = p.golge ? `<ellipse cx="${CX}" cy="${TABAN + 3.5}" rx="${f(26 * p.sx - Math.abs(p.dy) * .25)}" ry="${f(3.6 - Math.abs(p.dy) * .04)}" fill="#000" opacity="${f(Math.max(.06, .2 - Math.abs(p.dy) * .005))}"/>` : '';
  const kulak = (i) => { const [kx, ky] = KULAK[i], [tx, ty] = KULAK_TABAN[i], r = i ? p.kulak : -p.kulak; return `<g transform="rotate(${f(r)} ${tx} ${ty})">${sembol('kulak', kx, ky)}</g>`; };
  const kol = (i) => { const [kx, ky] = KOL[i], r = i ? -p.kol[i] : p.kol[i]; return `<g transform="translate(${f(kx)} ${f(ky + p.kolUzun)}) rotate(${f(r)})">${SEMBOL.kol}</g>`; };
  const yuz = `${sembol('allik', -24 + p.yuz[0], 2 + p.yuz[1], ` scale(1)`).replace('<ellipse', `<ellipse opacity="${p.allik}"`)}${sembol('allik', 24 + p.yuz[0], 2 + p.yuz[1]).replace('<ellipse', `<ellipse opacity="${p.allik}"`)}${goz(0, p, 'c0' + id)}${goz(1, p, 'c1' + id)}${agiz(p)}`;
  const karin = `<g opacity="${p.karin}">${sembol('karin', 0, 22)}</g>`;
  const govde = `<g transform="translate(${f(p.dx)} ${f(p.dy)}) translate(${CX} ${TABAN}) scale(${f(p.sx)} ${f(p.sy)}) translate(0 ${-RG}) rotate(${f(p.rot)})">` +
    `${kulak(0)}${kulak(1)}${p.yuzOnde ? '' : kol(0) + kol(1)}${SEMBOL.govde}${karin}${yuz}${p.yuzOnde ? kol(0) + kol(1) : ''}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><style>${stil}</style>${defs(durumRenk)}${golge}${iz}<g filter="url(#h)">${govde}${p.ek}</g></svg>\n`;
}

// ---------- ek çizimler ----------
const noktalar = (n) => [[104, 40], [113, 33], [122, 27]].slice(0, n).map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${2.4 + i * .5}" fill="#fff"/>`).join('');
const zz = (x, y, s) => `<path d="M${x} ${y} h${f(7 * s)} l${f(-7 * s)} ${f(7 * s)} h${f(7 * s)}" fill="none" stroke="#fff" stroke-width="${f(2.2 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const halka = (r) => `<circle cx="108" cy="38" r="8" fill="none" stroke="#FFC24D" stroke-width="3.2" stroke-dasharray="32 18" stroke-linecap="round" transform="rotate(${r} 108 38)"/>`;
const unlem = (op) => `<g transform="translate(110 30)" fill="#FF3B3B" opacity="${op}"><rect x="-2.5" y="-10" width="5" height="12" rx="2.5"/><circle cy="6.5" r="2.6"/></g>`;
const ekranCiz = (satir) => `<g transform="translate(46 94)"><rect width="36" height="24" rx="3.5" fill="${R.ekran}" stroke="#cfd6ea" stroke-width="1.4"/>` +
  [[5, 6, 18], [5, 11, 24], [5, 16, 14], [5, 21, 20]].slice(0, satir).map(([x, y, w]) => `<rect x="${x}" y="${y - 1}" width="${w}" height="2" rx="1" class="t" opacity=".9"/>`).join('') + '</g>';

// ---------- animasyonlar ----------
const S = Math.sin, PI = Math.PI;
const anim = {
  idle: [{}, { sy: 1.015, sx: .995 }, { sy: 1.03, sx: .99, kulak: -2 }, { sy: 1.015, sx: .995 }, { kapak: 1 }, { bakis: [2.5, 0] }],
  walk: [...Array(8)].map((_, i) => { // yatay süzülme: hafif bob, kollar geride, karın ışığı iz bırakır
    const a = i * PI / 4, s = S(a);
    return { dy: -8 - 4 * s, rot: 5, kol: [70 + 6 * s, -15 - 5 * s], kulak: 10 + 3 * s, bakis: [3, 0], karin: 1 + .1 * s, iz: { n: 3, yon: [-1, .15] } };
  }),
  hop: [ // sekerek ilerleme (isteğe bağlı): hazırlık ezilmesi → fırlama uzaması → havada → iniş ezilmesi → toparlanma
    { sx: 1.08, sy: .9, bakis: [3, 0], kol: [-20, -20] },
    { sx: .94, sy: 1.12, dy: -6, kulak: 10, bakis: [3, 0], kol: [25, 25] },
    { sx: .98, sy: 1.04, dy: -16, kulak: 14, bakis: [3, -1], kol: [40, 40] },
    { dy: -22, kulak: 4, bakis: [3, -1], kol: [30, 30] },
    { sx: .99, sy: 1.02, dy: -16, kulak: -8, bakis: [3, 0], kol: [20, 20] },
    { sx: .96, sy: 1.08, dy: -4, kulak: -12, bakis: [3, 1], kol: [10, 10] },
    { sx: 1.1, sy: .88, kulak: -4, bakis: [3, 0], kol: [-15, -15] },
    { sx: 1.02, sy: .97, bakis: [3, 0], kol: [-5, -5] },
  ],
  climb: [0, 1, 2, 3].map((i) => ({ dx: 24, sy: 1.03 + .03 * S(i * PI / 2), sx: 1 - .015 * S(i * PI / 2), dy: -3 - 3 * S(i * PI / 2), kol: [125 + 8 * S(i * PI / 2), 125 - 8 * S(i * PI / 2)],
    kulak: -8, bakis: [1, -3], karin: 1.15 + .15 * S(i * PI / 2), iz: { n: 2, yon: [0, 1] }, golge: false })), // dikey süzülme (duvar sağda)
  fly: [0, 1, 2, 3].map((i) => ({ dy: -12 - 3 * S(i * PI / 2), rot: 14, kol: [115 + 8 * S(i * PI / 2), 40 - 8 * S(i * PI / 2)],
    kulak: 16, bakis: [3, 0], karin: 1.25, iz: { n: 3, yon: [-1, .3] }, golge: false })), // hızlı geçiş: eğik, kulaklar geride
  peek: [{ dx: 26, yuz: [6, 2], bakis: [3, 0], kulak: -4, kol: [-25, -25] }, { dx: 26, yuz: [6, 2], kapak: 1, kulak: -4, kol: [-25, -25] }, { dx: 26, yuz: [6, 2], bakis: [3, 2], kulak: 2, kol: [-25, -25] }],
  peek_side: [20, 26, 30].map((dx, i) => ({ dx, yuz: [5 + i, 2], bakis: [2 + (i > 0 ? 1 : 0), i === 2 ? 1 : 0], kulak: -8, kol: [-25, -25] })), // pencere yan kenarı: köşeden giderek daha çok uzanır
  peek_top: [{ bakis: [0, -3], kulak: -10, kol: [150, 150] }, { kapak: 1, kulak: -10, kol: [150, 150] }, { bakis: [3, -2], kulak: -10, kol: [150, 150] }], // pencere üst kenarı: eller kenarda, yalnız kulak+gözler
  hide: [{ sx: 1.06, sy: .94, bakis: [3, 0] }, { sx: 1.14, sy: .84, dx: 3, rot: 4, kulak: 10, bakis: [3, 1], kapak: .25 }, { sx: 1.22, sy: .76, dx: 7, rot: 6, kulak: 18, bakis: [3, 2], kapak: .5, kol: [-30, -30] }],
  sit: [{ sx: 1.04, sy: .95, kolUzun: 12, kol: [-8, -8], bakis: [1, 1] }, { sx: 1.04, sy: .95, kolUzun: 12, kol: [2, 2], bakis: [1, 1] }, { sx: 1.04, sy: .95, kolUzun: 12, kol: [12, 12], bakis: [1, 1], rot: 1.5 }],
  wave: [[150, -2], [172, -4], [150, -2], [125, 0]].map(([a, r]) => ({ kol: [0, a], rot: r, bakis: [1, -1], agiz: 'gulumse', yuzOnde: true })),
  think: [1, 2, 3].map((n) => ({ rot: -5, bakis: [2, -3], kol: [0, 110], durum: 'dusunuyor', ek: noktalar(n), yuzOnde: true })),
  work: [[-35, 55, 1], [-55, 40, 2], [-40, 60, 3], [-50, 45, 4]].map(([l, r, s]) => ({ kol: [-45 - l / 10, -45 - r / 10], bakis: [0, 3], ek: ekranCiz(s), yuzOnde: true, durum: 'bosta' })),
  speak: [{ agiz: 'gulumse', karin: .8 }, { agiz: 'o', karin: .95 }, { agiz: 'O', karin: 1.1, sy: 1.01 }],
  wait: [{ rot: 7, bakis: [2, -2], egim: -.5, kapak: .08, durum: 'onay', ek: halka(0), kol: [10, 10] }, { rot: 7, bakis: [2, -2], egim: -.5, kapak: .08, durum: 'onay', ek: halka(180), kol: [10, 10] }],
  error: [{ sx: 1.08, sy: 1.08, dx: 2.5, kapak: .6, egim: -.4, agiz: 'uzgun', allik: .9, durum: 'hata', karin: 1.1, kulak: 8, ek: unlem(1), kol: [30, 30] },
    { sx: 1.05, sy: 1.05, dx: -2.5, kapak: .56, egim: -.35, agiz: 'uzgun', allik: .8, durum: 'hata', karin: 1, kulak: 6, ek: unlem(.75), kol: [25, 25] }],
  sleep: [{ sx: 1.03, sy: .97, kapak: 1, agiz: 'gulumse', kulak: 12, karin: .3, durum: 'uyku', ek: zz(100, 36, 1) },
    { sx: 1.01, sy: 1, kapak: 1, agiz: 'gulumse', kulak: 10, karin: .35, durum: 'uyku', ek: zz(102, 38, .9) + zz(112, 22, 1.4) }],
  idle_serious: [{ kapak: .42, egim: .55, agiz: 'duz', durum: 'ciddi', karin: .7, allik: .3 }, { kapak: .42, egim: .55, agiz: 'duz', durum: 'ciddi', karin: .7, allik: .3, sy: 1.015, sx: .995 }],
  speak_serious: [{ kapak: .42, egim: .55, agiz: 'duz', durum: 'ciddi', karin: .75, allik: .3 }, { kapak: .42, egim: .55, agiz: 'o', durum: 'ciddi', karin: .9, allik: .3 }],
};
const FPS = { idle: 4, walk: 8, hop: 10, climb: 6, fly: 10, peek: 2, peek_side: 3, peek_top: 2, hide: 8, sit: 2, wave: 8, think: 3, work: 8, speak: 8, wait: 3, error: 4, sleep: 1.5, idle_serious: 2, speak_serious: 6 };
const TEK = new Set(['hide']); // döngüsüz: son karede kalır
const PINGPONG = new Set(['sit', 'speak', 'think', 'speak_serious', 'peek_side']); // kare dizisi [1,2,3,2]: döngü atlaması olmasın

// ---------- ikonlar ----------
// Tepsi ikonu: baş silüeti (küre + iki kulak); tek renkte gözler delik (evenodd). 32 viewBox.
const IKON_YOL = 'M16 5.5 a10.5 10.5 0 1 1 -.01 0 Z M7 8.6 a4.2 4.2 0 1 1 -.01 0 Z M25 8.6 a4.2 4.2 0 1 1 -.01 0 Z';
const ikonTek = (renk) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="${renk}" fill-rule="evenodd" d="${IKON_YOL} M11.5 15.5 a3.3 3.3 0 1 0 .01 0 Z M20.5 15.5 a3.3 3.3 0 1 0 .01 0 Z"/></svg>`;
const ikonRenkli = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>${stil}</style><defs><radialGradient id="gv" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".6" stop-color="${R.govde}"/><stop offset="1" stop-color="${R.govdeGolge}"/></radialGradient></defs>` +
  `<g stroke="${R.kontur}" stroke-width="1" stroke-opacity=".7"><circle cx="7" cy="8.6" r="4.2" fill="url(#gv)"/><circle cx="25" cy="8.6" r="4.2" fill="url(#gv)"/><circle cx="7" cy="8.6" r="2.2" class="t" stroke="none" opacity=".85"/><circle cx="25" cy="8.6" r="2.2" class="t" stroke="none" opacity=".85"/>` +
  `<circle cx="16" cy="16" r="10.5" fill="url(#gv)"/></g><ellipse cx="16" cy="22.5" rx="4.5" ry="2.4" class="t" opacity=".75"/>` +
  `<g fill="${R.goz}"><circle cx="11.5" cy="15.5" r="3.4"/><circle cx="20.5" cy="15.5" r="3.4"/></g><g fill="none" class="ts" stroke-width="1"><circle cx="11.5" cy="15.5" r="1.9"/><circle cx="20.5" cy="15.5" r="1.9"/></g>` +
  `<g fill="#fff"><circle cx="10.3" cy="14.2" r="1.1"/><circle cx="19.3" cy="14.2" r="1.1"/></g><path d="M14.5 20 q1.5 1.3 3 0" fill="none" stroke="${R.agiz}" stroke-width=".9" stroke-linecap="round"/></svg>`;
const rozetli = (svg, renk) => svg.replace('</svg>', `<circle cx="25.5" cy="25.5" r="5.5" fill="${renk}" stroke="#fff" stroke-width="1.6"/></svg>`);
const ROZET = { calisiyor: '#4FB3FF', bekliyor: '#FFC24D', hata: '#FF3B3B' };
// Avatar: yüze yakın kırpım (gövde + kulaklar), saydam zemin.
const avatar = () => kare({ bakis: [1, 0], golge: false }).replace('viewBox="0 0 128 128" width="128" height="128"', 'viewBox="18 30 92 92" width="128" height="128"');

// ---------- master SVG (semboller + boşta duruş; belge amaçlı) ----------
const master = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<!-- Pamuk master: semboller + boşta duruş. Kareler kare-uret.mjs ile bu parçalardan üretilir. Renk değişkenleri: --ten --vurgu --dolgu -->
<style>${stil}</style>${defs('var(--ten)')}
${Object.entries(SEMBOL).map(([ad, ic]) => `<symbol id="${ad}" overflow="visible">${ic}</symbol>`).join('\n')}
<g filter="url(#h)" transform="translate(${CX} ${CY})">
<use href="#kulak" x="${KULAK[0][0]}" y="${KULAK[0][1]}"/><use href="#kulak" x="${KULAK[1][0]}" y="${KULAK[1][1]}"/>
<use href="#kol" x="${KOL[0][0]}" y="${KOL[0][1]}"/><use href="#kol" x="${KOL[1][0]}" y="${KOL[1][1]}"/>
<use href="#govde"/><use href="#karin" y="22"/><use href="#allik" x="-24" y="2" opacity=".5"/><use href="#allik" x="24" y="2" opacity=".5"/>
<g transform="translate(${GOZ[0][0]} ${GOZ[0][1]})"><use href="#gozKure"/><use href="#iris"/><use href="#parilti"/></g>
<g transform="translate(${GOZ[1][0]} ${GOZ[1][1]})"><use href="#gozKure"/><use href="#iris"/><use href="#parilti"/></g>
<path d="M-4 6 q4 3.4 8 0" fill="none" stroke="${R.agiz}" stroke-width="1.9" stroke-linecap="round"/>
</g></svg>
`;

// ---------- üretim ----------
const svgFrames = [], animations = {}, dosyalar = {};
for (const [ad, kareler] of Object.entries(anim)) {
  const idx = [];
  kareler.forEach((o, i) => { const dosya = `${ad}-${i + 1}.svg`; dosyalar[dosya] = kare(o); idx.push(svgFrames.length); svgFrames.push(dosya); });
  animations[ad] = { frames: PINGPONG.has(ad) ? [...idx, ...idx.slice(1, -1).reverse()] : idx, fps: FPS[ad], loop: !TEK.has(ad) };
}
const sheet = {
  frameW: 256, frameH: 256, scale: .25, anchor: [128, 244], peekVisible: .4, peekTop: .66,
  image: 'sheet.png', image1x: 'sheet@1x.png', columns: 8,
  tint: tenAd, tints: TENLER, statusColors: { bosta: 'tint.ten', dusunuyor: 'tint.vurgu', onay: '#FFC24D', hata: '#FF3B3B', uyku: 'tint.ten', ciddi: '#4FB3FF' },
  svgFrames, animations,
};
dosyalar['sheet.json'] = JSON.stringify(sheet, null, 2) + '\n';
dosyalar['pamuk.master.svg'] = master();
for (const [ad, renk] of Object.entries({ 'tepsi-acik': '#2b2b30', 'tepsi-koyu': '#e9e6df' })) {
  dosyalar[`icons/${ad}.svg`] = ikonTek(renk);
  for (const [r, c] of Object.entries(ROZET)) dosyalar[`icons/${ad}-${r}.svg`] = rozetli(ikonTek(renk), c);
}
dosyalar['icons/tepsi-renkli.svg'] = ikonRenkli();
for (const [r, c] of Object.entries(ROZET)) dosyalar[`icons/tepsi-renkli-${r}.svg`] = rozetli(ikonRenkli(), c);
dosyalar['icons/avatar.svg'] = avatar();
dosyalar['onizleme.html'] = onizleme(sheet, dosyalar['idle-1.svg']);

for (const kok of cikti) {
  mkdirSync(join(kok, 'icons'), { recursive: true });
  for (const [ad, ic] of Object.entries(dosyalar)) writeFileSync(join(kok, ad), ic);
}
console.log(`${svgFrames.length} kare, ${Object.keys(dosyalar).length} dosya → ${cikti.join(' , ')}`);

// ---------- önizleme sayfası ----------
function onizleme(sheet, idleSvg) {
  const inlineSvg = idleSvg.replace(/<style>[^<]*<\/style>/, '').replace(/id="(c[01][a-z0-9]+|gv|gk|ge|gb|ga|h)"/g, 'id="$1-IN"').replace(/url\(#(c[01][a-z0-9]+|gv|gk|ge|gb|ga|h)\)/g, 'url(#$1-IN)');
  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pamuk — 2D sprite önizleme</title>
<style>
:root{--ten:${ten.ten};--vurgu:${ten.vurgu};--dolgu:${ten.dolgu}}
*{box-sizing:border-box}body{margin:0;background:#15171c;color:#e9e6df;font:14px/1.5 system-ui,"Segoe UI",Roboto,Arial,sans-serif}
header{padding:18px 20px 6px;max-width:1326px;margin:0 auto}h1{font-size:20px;margin:0 0 4px;font-weight:600}header p{margin:0;color:#a9a59b}
.kontrol{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 20px;max-width:1326px;margin:0 auto}
.kontrol b{font-weight:600;margin-right:4px}.kontrol .grup{display:flex;flex-wrap:wrap;gap:4px;align-items:center;background:#1e2127;border:1px solid #2f343d;border-radius:10px;padding:6px 8px}
button,select{background:#262a32;color:#e9e6df;border:1px solid #3a3f4a;border-radius:7px;padding:4px 10px;font:inherit;cursor:pointer}button.aktif{background:#d8a84a;color:#15171c;border-color:#d8a84a}
label{display:flex;gap:4px;align-items:center;cursor:pointer}
.masa{position:relative;width:1326px;max-width:100%;height:560px;margin:8px auto;border-radius:12px;overflow:hidden;border:1px solid #2f343d;background:#1c1f27}
.masa.koyu{background:radial-gradient(1200px 600px at 30% 20%,#2a3350,#0e1120 70%)}
.masa.acik{background:linear-gradient(160deg,#f3efe8,#d9e2ec 60%,#c7d3df)}
.masa.foto{background:
 radial-gradient(500px 300px at 15% 25%,rgba(255,170,90,.75),transparent 70%),radial-gradient(600px 400px at 80% 70%,rgba(70,120,200,.8),transparent 70%),
 radial-gradient(300px 300px at 55% 40%,rgba(255,255,255,.55),transparent 70%),repeating-linear-gradient(115deg,rgba(255,255,255,.07) 0 3px,rgba(0,0,0,.08) 3px 7px),linear-gradient(180deg,#5c7a9c,#2d3f55 60%,#7d6b5a)}
.cubuk{position:absolute;left:0;right:0;bottom:0;height:48px;background:rgba(16,18,23,.92);border-top:1px solid #3a3f4a;display:flex;align-items:center;justify-content:center;gap:10px}
.masa.acik .cubuk{background:rgba(240,240,242,.96);border-top-color:#c9ccd2}
.cubuk i{width:24px;height:24px;border-radius:6px;display:block}.cubuk .saat{position:absolute;right:16px;color:#8a8f99;font-size:12px}
.pen{position:absolute;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35);border:1px solid rgba(0,0,0,.25)}
.pen .bas{height:32px;background:#dfe3ea;display:flex;align-items:center;padding:0 10px;gap:6px;font-size:12px;color:#444}.pen .bas i{width:10px;height:10px;border-radius:50%;display:inline-block}
.pen .ic{background:#fbfbfc;height:100%;padding:12px;color:#555;font-size:12px}
.pen.koyu .bas{background:#30364a;color:#dde}.pen.koyu .ic{background:#262b36;color:#9aa}
.pen .ic div{height:6px;border-radius:3px;background:#dcdfe5;margin:8px 0}.pen.koyu .ic div{background:#3a4152}
#k{position:absolute;left:0;top:0;transform-origin:0 0;image-rendering:auto}
.satir{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:1326px;margin:12px auto;padding:0 20px}
.kutu{background:#1e2127;border:1px solid #2f343d;border-radius:10px;padding:10px}.kutu h3{margin:0 0 8px;font-size:13px;font-weight:600;color:#a9a59b;text-transform:uppercase;letter-spacing:.06em}
.serit{display:flex;gap:14px;align-items:flex-end;padding:10px;border-radius:8px}.serit span{font-size:11px;color:#9aa;display:block;text-align:center;margin-top:4px}
.serit.koyu{background:radial-gradient(400px 200px at 30% 20%,#2a3350,#0e1120)}.serit.acik{background:linear-gradient(160deg,#f3efe8,#c7d3df)}.serit.foto{background:radial-gradient(200px 120px at 20% 30%,rgba(255,170,90,.8),transparent 70%),radial-gradient(250px 160px at 80% 70%,rgba(70,120,200,.9),transparent 70%),repeating-linear-gradient(115deg,rgba(255,255,255,.07) 0 3px,rgba(0,0,0,.08) 3px 7px),linear-gradient(180deg,#5c7a9c,#7d6b5a)}
.serit img{display:block}
.tepsi{display:flex;flex-direction:column;gap:6px}.tepsi .bar{display:flex;align-items:center;gap:14px;padding:8px 12px;border-radius:6px}.tepsi .bar.acik{background:#f0f0f2}.tepsi .bar.koyu{background:#101217}
.tepsi img{display:block}.tepsi small{color:#8a8f99;font-size:11px;margin-left:auto}
.tenler{display:flex;gap:10px}.tenler div{flex:1;border-radius:8px;padding:6px;text-align:center;font-size:12px;color:#ccc}.tenler svg{width:96px;height:96px;display:block;margin:0 auto}
.tenler .volt{--ten:#4FB3FF;--vurgu:#8A4DFF;--dolgu:#7fa6ff;background:#182a5c}.tenler .aura{--ten:#1FC9BD;--vurgu:#9B6DFF;--dolgu:#bfe6ff;background:#edf5fb;color:#334}.tenler .auraGece{--ten:#35E6A0;--vurgu:#8E5BFF;--dolgu:#6fe0b8;background:#12233d}
.avatarlar{display:flex;gap:12px;align-items:flex-end}.avatarlar img{border-radius:50%;background:#182a5c;display:block}
footer{max-width:1326px;margin:0 auto;padding:10px 20px 30px;color:#8a8f99;font-size:12px}
</style></head><body>
<header><h1>Pamuk — 2D sprite önizleme</h1><p>${sheet.svgFrames.length} kare · viewBox 128 · çapa alt-orta · kareler sağa bakar (sola bakış flip). Düğmeler animasyonu oynatır; konum seçimi motorun yerleşimini taklit eder.</p></header>
<div class="kontrol">
  <div class="grup"><b>Animasyon</b>${Object.keys(sheet.animations).map((a) => `<button data-anim="${a}">${a}</button>`).join('')}</div>
  <div class="grup"><b>Duvar kâğıdı</b><button data-duvar="koyu" class="aktif">koyu</button><button data-duvar="acik">açık</button><button data-duvar="foto">fotoğraf</button></div>
  <div class="grup"><b>Ölçek</b><select id="olcek"><option value=".75">0,75</option><option value="1" selected>1</option><option value="1.5">1,5</option></select>
    <label><input type="checkbox" id="flip"> sola bak</label><label><input type="checkbox" id="ciddi"> ciddi</label>
    <b style="margin-left:8px">Konum</b><select id="konum"><option value="zemin">görev çubuğu</option><option value="pencere">pencere üstü (sit)</option><option value="kenar">sağ kenar (peek)</option><option value="duvar">sağ duvar (climb)</option></select>
    <label><input type="checkbox" id="dur"> kare kare</label><button id="ileri">▸ kare</button><span id="bilgi" style="color:#8a8f99;font-size:12px"></span></div>
</div>
<div class="masa koyu" id="masa">
  <div class="pen" style="left:120px;top:70px;width:520px;height:330px"><div class="bas"><i style="background:#d86a5a"></i><i style="background:#d8a84a"></i><i style="background:#6fbf8a"></i> Belgeler — not.txt</div><div class="ic"><div style="width:60%"></div><div style="width:85%"></div><div style="width:40%"></div><div style="width:70%"></div></div></div>
  <div class="pen koyu" style="left:700px;top:130px;width:460px;height:300px"><div class="bas"><i style="background:#d86a5a"></i><i style="background:#d8a84a"></i><i style="background:#6fbf8a"></i> Terminal</div><div class="ic"><div style="width:50%"></div><div style="width:75%"></div><div style="width:30%"></div></div></div>
  <div class="cubuk"><i style="background:#5b8def"></i><i style="background:#e0a548"></i><i style="background:#6fbf8a"></i><i style="background:#c66"></i><span class="saat">21:30</span></div>
  <canvas id="k"></canvas>
</div>
<div class="satir">
  <div class="kutu"><h3>Okunurluk · 48 / 64 / 96 px</h3>
    ${['koyu', 'acik', 'foto'].map((d) => `<div class="serit ${d}">${[48, 64, 96].map((s) => `<div><img src="idle-1.svg" width="${s}" height="${s}" alt=""><span>${s}</span></div>`).join('')}<div><img src="idle_serious-1.svg" width="64" height="64" alt=""><span>ciddi</span></div><div><img src="error-1.svg" width="64" height="64" alt=""><span>hata</span></div></div>`).join('')}
  </div>
  <div class="kutu"><h3>Tepsi ikonları · 16 / 24 / 32 + rozet</h3><div class="tepsi">
    <div class="bar acik">${[16, 24, 32].map((s) => `<img src="icons/tepsi-acik.svg" width="${s}" height="${s}" alt="">`).join('')}${['calisiyor', 'bekliyor', 'hata'].map((r) => `<img src="icons/tepsi-acik-${r}.svg" width="24" height="24" alt="">`).join('')}<img src="icons/tepsi-renkli.svg" width="24" height="24" alt=""><small>açık çubuk</small></div>
    <div class="bar koyu">${[16, 24, 32].map((s) => `<img src="icons/tepsi-koyu.svg" width="${s}" height="${s}" alt="">`).join('')}${['calisiyor', 'bekliyor', 'hata'].map((r) => `<img src="icons/tepsi-koyu-${r}.svg" width="24" height="24" alt="">`).join('')}<img src="icons/tepsi-renkli.svg" width="24" height="24" alt=""><small>koyu çubuk</small></div>
    <div class="bar koyu">${['', '-calisiyor', '-bekliyor', '-hata'].map((r) => `<img src="icons/tepsi-renkli${r}.svg" width="32" height="32" alt="">`).join('')}<small>renkli 32 + rozet</small></div>
  </div>
  <h3 style="margin-top:12px">Avatar · 64 / 128</h3><div class="avatarlar"><img src="icons/avatar.svg" width="64" height="64" alt=""><img src="icons/avatar.svg" width="128" height="128" alt=""></div></div>
  <div class="kutu"><h3>Tenler · CSS değişkeni (--ten / --vurgu / --dolgu)</h3><div class="tenler">${['volt', 'aura', 'auraGece'].map((t) => `<div class="${t}">${inlineSvg.replace('<svg ', '<svg class="in" ')}${t}</div>`).join('')}</div>
    <p style="color:#8a8f99;font-size:12px;margin:8px 0 0">Aynı SVG, yalnız değişkenler farklı. Motor PNG/IMG yoluyla yüklediğinde SVG içindeki varsayılan (${tenAd}) geçerli; başka ten için <code>node kare-uret.mjs --ten aura</code>.</p></div>
</div>
<footer>sheet.json: frameW/H ${sheet.frameW} (sheet.png @2x), scale ${sheet.scale} → ekranda 64 px; anchor [${sheet.anchor}]; peekVisible ${sheet.peekVisible}; peekTop ${sheet.peekTop}.</footer>
<script type="application/json" id="sheet">${JSON.stringify(sheet)}</script>
<script>
(() => {
  const sheet = JSON.parse(document.getElementById('sheet').textContent);
  const masa = document.getElementById('masa'), kanvas = document.getElementById('k'), ctx = kanvas.getContext('2d');
  const FW = 128, img = new Map();
  const yukle = (ad) => img.get(ad) || (img.set(ad, new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = ad; })), img.get(ad));
  const K = { anim: 'idle', kare: 0, olcek: 1, flip: false, ciddi: false, konum: 'zemin', dur: false };
  let zaman = null;
  const animAd = () => (K.ciddi && sheet.animations[K.anim + '_serious'] ? K.anim + '_serious' : K.anim);
  function konum() { // çapa (ayak) noktası, masa koordinatında
    const W = masa.clientWidth, H = masa.clientHeight, fw = 64 * K.olcek, ax = sheet.anchor[0] / sheet.frameW * fw;
    if (K.konum === 'pencere') return { x: 120 + 520 - fw / 2 - 6, y: 70, yon: K.flip ? -1 : 1 };
    if (K.konum === 'kenar') { const gor = sheet.peekVisible * fw; return { x: W - gor + (fw - ax), y: H - 48, yon: -1 }; }
    if (K.konum === 'duvar') return { x: W - fw / 2, y: H - 48 - 140, yon: 1 };
    return { x: W * .62, y: H - 48, yon: K.flip ? -1 : 1 };
  }
  async function ciz() {
    const a = sheet.animations[animAd()], fw = 64 * K.olcek, dpr = devicePixelRatio || 1;
    const f = a.frames[Math.min(K.kare, a.frames.length - 1)], ad = sheet.svgFrames[f], i = await yukle(ad);
    kanvas.width = Math.round(fw * dpr); kanvas.height = kanvas.width; kanvas.style.width = kanvas.style.height = fw + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, fw, fw); ctx.drawImage(i, 0, 0, fw, fw);
    const p = konum(), ax = sheet.anchor[0] / sheet.frameW * fw, ay = sheet.anchor[1] / sheet.frameH * fw;
    const sol = p.yon > 0 ? p.x - ax : p.x - (fw - ax), ust = p.y - ay;
    kanvas.style.transform = 'translate(' + sol + 'px,' + ust + 'px)' + (p.yon < 0 ? ' translateX(' + fw + 'px) scaleX(-1)' : '');
    document.getElementById('bilgi').textContent = animAd() + ' · kare ' + (K.kare + 1) + '/' + a.frames.length + ' (' + ad + ') · ' + a.fps + ' fps';
  }
  function dongu() {
    clearTimeout(zaman); const a = sheet.animations[animAd()];
    ciz(); if (K.dur) return;
    if (K.kare >= a.frames.length - 1 && !a.loop) return;
    zaman = setTimeout(() => { K.kare = (K.kare + 1) % a.frames.length; dongu(); }, 1000 / a.fps);
  }
  const oynat = (ad) => { K.anim = ad; K.kare = 0; document.querySelectorAll('[data-anim]').forEach((b) => b.classList.toggle('aktif', b.dataset.anim === ad)); dongu(); };
  document.querySelectorAll('[data-anim]').forEach((b) => b.addEventListener('click', () => oynat(b.dataset.anim)));
  document.querySelectorAll('[data-duvar]').forEach((b) => b.addEventListener('click', () => { masa.className = 'masa ' + b.dataset.duvar; document.querySelectorAll('[data-duvar]').forEach((x) => x.classList.toggle('aktif', x === b)); }));
  document.getElementById('olcek').addEventListener('change', (e) => { K.olcek = +e.target.value; ciz(); });
  document.getElementById('flip').addEventListener('change', (e) => { K.flip = e.target.checked; ciz(); });
  document.getElementById('ciddi').addEventListener('change', (e) => { K.ciddi = e.target.checked; K.kare = 0; dongu(); });
  document.getElementById('konum').addEventListener('change', (e) => { K.konum = e.target.value; oynat({ pencere: 'sit', kenar: 'peek', duvar: 'climb' }[K.konum] || 'idle'); });
  document.getElementById('dur').addEventListener('change', (e) => { K.dur = e.target.checked; dongu(); });
  document.getElementById('ileri').addEventListener('click', () => { K.kare = (K.kare + 1) % sheet.animations[animAd()].frames.length; ciz(); });
  window.pamuk = { oynat, kare: (n) => { K.dur = true; K.kare = n; ciz(); }, olcek: (v) => { K.olcek = v; ciz(); }, flip: (b) => { K.flip = b; ciz(); }, ciddi: (b) => { K.ciddi = b; dongu(); },
    konum: (k) => { K.konum = k; ciz(); }, duvar: (d) => { masa.className = 'masa ' + d; }, hazir: () => Promise.all([...img.values()]) };
  oynat('idle');
})();
</script></body></html>
`;
}
