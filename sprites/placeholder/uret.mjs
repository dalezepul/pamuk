// Yer tutucu yaratığı SVG kareleri olarak çizer ve sheet.json'u yazar: node sprites/placeholder/uret.mjs
// Kurallar (sözleşme): tüm kareler SAĞA bakar; 64×64; çapa (anchor) [32,61] = ayak tabanı ortası.
// climb: duvar karenin SAĞ kenarında (x=64). peek: yaratık sol tarafta saklı, yalnız sağdaki %40'ı (x ≥ 38) görünür.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const KONTUR = '#1c2240', GOVDE = '#7aa2ff';
const f1 = (n) => +n.toFixed(1);

function kare({ cx = 32, cy = 38, rx = 16, ry = 14, ayak, el = [], goz = 'acik', bebek = [1.2, 0], gozler, agiz = null, renk = GOVDE, ek = '' }) {
  ayak ??= [[cx - 7, 60], [cx + 7, 60]];
  const kalca = [[cx - 6, cy + ry - 3], [cx + 6, cy + ry - 3]];
  const omuz = [[cx - 12, cy + 2], [cx + 12, cy + 2]];
  const cizgi = (a, b) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/>`;
  const bacak = ayak.map((p, i) => cizgi(kalca[i], p) + `<ellipse cx="${f1(p[0] + 1.5)}" cy="${f1(p[1])}" rx="3.6" ry="1.9" fill="${KONTUR}"/>`).join('');
  const kol = el.map((p, i) => p && cizgi(omuz[i], p) + `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.4" fill="${renk}"/>`).join('');
  gozler ??= [[cx + 2, cy - 3], [cx + 11, cy - 3]];
  const goz1 = ([x, y]) => {
    if (goz === 'kapali') return `<path d="M${f1(x - 3.5)} ${f1(y)} q3.5 3 7 0" fill="none"/>`;
    if (goz === 'x') return `<path d="M${f1(x - 3)} ${f1(y - 3)} l6 6 m0 -6 l-6 6" fill="none"/>`;
    return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="4" ry="${goz === 'kisik' ? 2 : 4.4}" fill="#fff"/>` +
      `<circle cx="${f1(x + bebek[0])}" cy="${f1(y + bebek[1])}" r="${goz === 'kisik' ? 1.4 : 2}" fill="${KONTUR}" stroke="none"/>`;
  };
  const agizSvg = agiz == null ? '' : agiz === 'gul'
    ? `<path d="M${f1(cx + 3)} ${f1(cy + 5)} q4 3.5 8 0" fill="none"/>`
    : `<ellipse cx="${f1(cx + 7)}" cy="${f1(cy + 6)}" rx="3" ry="${agiz}" fill="${KONTUR}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<g stroke="${KONTUR}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${bacak}` +
    `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${rx}" ry="${ry}" fill="${renk}"/>` +
    `${gozler.map(goz1).join('')}${agizSvg}${kol}</g>${ek}</svg>\n`;
}
const yazi = (x, y, t, boy = 11, renk = KONTUR) =>
  `<text x="${x}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="${boy}" fill="${renk}">${t}</text>`;

const S = Math.sin, C = Math.cos, PI2 = Math.PI * 2;
const anim = {
  idle: [{}, { cy: 38.6, ry: 13.6 }, { cy: 39, ry: 13.3 }, { cy: 38.6, ry: 13.6, goz: 'kapali' }],
  walk: [...Array(6)].map((_, i) => {
    const a = (i / 6) * PI2, cy = 38 - Math.abs(S(a)) * 1.5;
    return { cy, ayak: [[25 + 6 * S(a), 60 - Math.max(0, 3 * C(a))], [39 - 6 * S(a), 60 - Math.max(0, -3 * C(a))]],
      el: [[18 - 4 * S(a), cy + 10], [46 + 4 * S(a), cy + 10]] };
  }),
  climb: [0, 1, 2, 3].map((i) => {
    const u = i % 2 === 0;
    return { cx: 42, cy: 34, ayak: [[58, u ? 58 : 52], [61, u ? 50 : 57]], el: [[60, u ? 12 : 20], [62, u ? 22 : 14]], bebek: [0, -1.5] };
  }),
  peek: [{ cx: 40, cy: 40, el: [null, [40, 52]], bebek: [1.6, 0] }, { cx: 40, cy: 40, el: [null, [40, 52]], bebek: [1.6, 1.4] }],
  hide: [{ cy: 42, ry: 12, goz: 'kisik' }, { cy: 47, ry: 10, rx: 17, goz: 'kisik' }, { cy: 53, ry: 7, rx: 18, goz: 'kapali', ayak: [[24, 61], [40, 61]] }],
  sit: [{ cy: 44, ry: 13, ayak: [[44, 58], [50, 58]] }, { cy: 44, ry: 13, ayak: [[44, 58], [50, 58]], goz: 'kapali' }],
  wave: [[52, 16], [56, 20], [52, 16], [47, 14]].map((p) => ({ el: [[18, 46], p], agiz: 'gul' })),
  think: [
    { bebek: [0.5, -2], el: [null, [40, 46]], ek: yazi(48, 14, '?', 13) },
    { bebek: [0.5, -2], el: [null, [40, 46]], ek: yazi(46, 14, '?', 11) + yazi(54, 10, '?', 13) },
  ],
  work: [0, 1, 2, 3].map((i) => ({
    bebek: [1.2, 2], el: [[42, i % 2 ? 50 : 48], [52, i % 2 ? 48 : 50]],
    ek: `<rect x="40" y="50" width="20" height="9" rx="1.5" fill="#d8dcea" stroke="${KONTUR}" stroke-width="2"/>`,
  })),
  speak: [1, 3, 2].map((agiz) => ({ agiz })),
  wait: [{ bebek: [-1.5, 0], ayak: [[25, 60], [39, 60]] }, { bebek: [2, 0], ayak: [[25, 60], [40, 57]] }],
  error: [
    { goz: 'x', renk: '#ff9a9a', agiz: 1.5, ek: yazi(52, 16, '!', 15, '#c62828') },
    { cx: 31, goz: 'x', renk: '#ff9a9a', agiz: 2.5, ek: yazi(53, 14, '!', 15, '#c62828') },
  ],
  sleep: [
    { cy: 44, ry: 12, rx: 17, goz: 'kapali', ayak: [[25, 60], [39, 60]], ek: yazi(48, 22, 'z', 10) },
    { cy: 44.6, ry: 11.6, rx: 17, goz: 'kapali', ayak: [[25, 60], [39, 60]], ek: yazi(50, 18, 'z', 10) + yazi(55, 10, 'Z', 12) },
  ],
};
const FPS = { idle: 8, walk: 10, climb: 8, peek: 2, hide: 8, sit: 2, wave: 8, think: 3, work: 8, speak: 8, wait: 3, error: 6, sleep: 1.5 };
const TEK = new Set(['hide']); // döngüsüz (son karede kalır)

const svgFrames = [], animations = {};
for (const [ad, kareler] of Object.entries(anim)) {
  animations[ad] = { frames: [], fps: FPS[ad], loop: !TEK.has(ad) };
  kareler.forEach((o, i) => {
    const dosya = `${ad}-${i + 1}.svg`;
    writeFileSync(join(DIR, dosya), kare(o));
    animations[ad].frames.push(svgFrames.length);
    svgFrames.push(dosya);
  });
}
writeFileSync(join(DIR, 'sheet.json'), JSON.stringify({ frameW: 64, frameH: 64, scale: 1, anchor: [32, 61], peekVisible: 0.4, svgFrames, animations }, null, 2) + '\n');
console.log(`${svgFrames.length} kare yazıldı.`);
