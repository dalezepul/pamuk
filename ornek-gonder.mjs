// Örnek: node ornek-gonder.mjs "Merhaba"            → bildirim
//        node ornek-gonder.mjs --soru "Devam?" Evet Hayır   (en çok 5 seçenek, her biri ≤40 karakter; süresiz: sure 0)
//        Ek alanlar elle: konu (balon etiketi), sira "2/3", sure (bildirim 5–1800, soru 0 | 5–86400; varsayılan 20)
//        node ornek-gonder.mjs --durum calisiyor      (bosta | calisiyor | bekliyor | hata)
//        node ornek-gonder.mjs --hata "Derleme kırıldı"   |   --bitti "Ajan bitti"
//        node ornek-gonder.mjs --test tirman [hwnd]   (tirman | batir | saklan | uyku | bildirim)
import net from 'node:net';

const [bayrak, ...kalan] = process.argv.slice(2);
let ileti;
if (bayrak === '--soru') ileti = { tip: 'soru', metin: kalan[0], secenekler: kalan.slice(1, 6), sure: 0 };
else if (bayrak === '--durum') ileti = { tip: 'durum', metin: kalan[0] };
else if (bayrak === '--hata' || bayrak === '--bitti') ileti = { tip: 'bildirim', metin: kalan[0], alt: bayrak.slice(2) };
else if (bayrak === '--test') ileti = { tip: 'test', metin: kalan[0], hwnd: Number(kalan[1]) || 0 };
else ileti = { tip: 'bildirim', metin: bayrak || 'Merhaba!' };

const c = net.connect(String.raw`\\.\pipe\zepul-yoldas`, () => c.write(JSON.stringify(ileti) + '\n'));
c.setEncoding('utf8');
c.on('data', (d) => { process.stdout.write(d); c.end(); });
c.on('error', (e) => { console.error('Yoldaş çalışmıyor mu?', e.message); process.exit(1); });
