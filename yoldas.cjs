// Dış API: yerel adlandırılmış boru (named pipe) \\.\pipe\zepul-yoldas. Ağ portu YOK.
// Her satır bir JSON ileti: {"tip":"bildirim"|"soru"|"durum"|"test"|"iptal", "metin":"…", "secenekler":["…" ×≤5, her biri ≤40], "kaynak":"zepul"|"claude"|"…",
//   "konu":"…" (balon etiketi), "sira":"2/3", "sure": bildirim 5–1800 | soru 0 (süresiz) ya da 5–86400, "alt":"hata"|"bitti", "hwnd":123, "cevapKanali":"zepul:z1a2b3"|"soru:s…"}
// Yanıt tek satır JSON: bildirim/soru için {"cevap": "<seçenek>"|"tamam"|null}, durum/test/iptal için {"ok":true}.
const net = require('node:net');

const BORU = String.raw`\\.\pipe\zepul-yoldas`;
const TIPLER = new Set(['bildirim', 'soru', 'durum', 'test', 'iptal']);
const KANAL = /^(zepul:z[0-9a-f]{5}|soru:s[0-9a-z]{9}[0-9a-f]{6})$/;
const kanalMi = (v) => typeof v === 'string' && KANAL.test(v);
// İsteğe bağlı kısa metin alanı: yoksa undefined, varsa 1–n karakter (kırpılmış).
function kisa(v, n, ad) {
  if (v == null) return undefined;
  if (typeof v !== 'string' || !v.trim() || v.trim().length > n) throw new Error(`${ad} 1–${n} karakter olmalı`);
  return v.trim();
}

function dogrula(m) {
  if (!m || typeof m !== 'object' || !TIPLER.has(m.tip)) throw new Error('tip geçersiz');
  if (m.tip === 'iptal') { if (!kanalMi(m.cevapKanali)) throw new Error('iptal: cevapKanali geçersiz'); return { tip: 'iptal', cevapKanali: m.cevapKanali }; }
  if (typeof m.metin !== 'string' || !m.metin.trim() || m.metin.length > 300) throw new Error('metin 1–300 karakter olmalı');
  const s = m.secenekler ?? [];
  if (!Array.isArray(s) || s.length > 5 || s.some((x) => typeof x !== 'string' || !x || x.length > 40)) throw new Error('secenekler en çok 5, her biri 1–40 karakter');
  const ust = m.tip === 'soru' ? 86400 : 1800;
  if (m.sure != null && !(typeof m.sure === 'number' && ((m.sure >= 5 && m.sure <= ust) || (m.sure === 0 && m.tip === 'soru'))))
    throw new Error(m.tip === 'soru' ? 'sure 0 ya da 5–86400 saniye olmalı' : 'sure 5–1800 saniye olmalı');
  if (m.sira != null && !(typeof m.sira === 'string' && /^\d{1,2}\/\d{1,2}$/.test(m.sira))) throw new Error('sira "2/3" biçiminde olmalı');
  return { tip: m.tip, metin: m.metin.trim(), secenekler: s, hwnd: Number.isSafeInteger(m.hwnd) ? m.hwnd : 0, alt: m.alt === 'hata' || m.alt === 'bitti' ? m.alt : undefined,
    kaynak: kisa(m.kaynak, 24, 'kaynak'), konu: kisa(m.konu, 40, 'konu'), sira: m.sira ?? undefined, sure: m.sure ?? undefined,
    // cevapKanali: cevabın boru dışında nereye iletileceği (main.cjs zepuleIlet): "zepul:<kimlik>" ya da "soru:<kimlik>".
    cevapKanali: m.tip === 'soru' && kanalMi(m.cevapKanali) ? m.cevapKanali : undefined };
}

// isle(ileti, baglanti) → Promise<yanıt nesnesi>; baglanti.kapaninca(cb): soket kapanınca cb çağrılır (soran vazgeçti).
function boruBaslat(isle) {
  const sunucu = net.createServer((c) => {
    let tampon = '';
    const kapanis = [], baglanti = { kapaninca: (f) => kapanis.push(f) };
    c.setEncoding('utf8');
    c.on('error', () => {});
    c.on('close', () => kapanis.splice(0).forEach((f) => f()));
    c.on('data', (d) => {
      tampon += d;
      if (tampon.length > 8192) return c.destroy();
      let i;
      while ((i = tampon.indexOf('\n')) >= 0) {
        const satir = tampon.slice(0, i); tampon = tampon.slice(i + 1);
        let m;
        try { m = dogrula(JSON.parse(satir)); } catch (e) { c.write(JSON.stringify({ hata: e.message }) + '\n'); continue; }
        Promise.resolve(isle(m, baglanti)).then((r) => { if (c.writable) c.write(JSON.stringify(r) + '\n'); });
      }
    });
  });
  sunucu.on('error', (e) => console.error('[yoldas] boru hatası:', e.message));
  sunucu.listen(BORU);
  return sunucu;
}

module.exports = { boruBaslat, dogrula, BORU };
