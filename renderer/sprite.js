// Sprite yükleyici. İki biçim:
//  1) sheet.png: kareler soldan sağa, yukarıdan aşağı frameW×frameH hücreler; animasyon "frames" = hücre indeksleri.
//  2) svgFrames: ["idle-1.svg", …]; "frames" = bu listedeki indeksler (ya da doğrudan dosya adı).
// Dönen nesne: { frameW, frameH, scale, anchor, peekVisible, animations, ciz(ctx, kare, w, h) }
function resimYukle(url) {
  return new Promise((coz, red) => { const i = new Image(); i.onload = () => coz(i); i.onerror = () => red(new Error('yüklenemedi: ' + url)); i.src = url; });
}

// svgMetin (isteğe bağlı): { "idle-1.svg": "<svg…>" } — ten değişkenleri uygulanmış SVG metinleri (main gönderir).
async function spriteYukle(taban, sheet, svgMetin) {
  const { frameW: fw, frameH: fh } = sheet;
  const kaynaklar = new Map(); // kare anahtarı → { img, sx, sy, svg }
  let atlas = null;
  if (!sheet.svgFrames) atlas = await resimYukle(taban + (sheet.image || 'sheet.png'));
  const sutun = atlas ? Math.max(1, Math.floor(atlas.naturalWidth / fw)) : 0;
  const anahtar = (f) => (typeof f === 'string' ? f : sheet.svgFrames ? sheet.svgFrames[f] : f);
  const isler = [];
  for (const a of Object.values(sheet.animations)) {
    for (const f of a.frames) {
      const k = anahtar(f);
      if (kaynaklar.has(k)) continue;
      if (typeof k === 'string') { kaynaklar.set(k, null); isler.push(resimYukle(svgMetin?.[k] ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMetin[k]) : taban + k).then((img) => kaynaklar.set(k, { img, svg: true }))); }
      else kaynaklar.set(k, { img: atlas, sx: (k % sutun) * fw, sy: Math.floor(k / sutun) * fh });
    }
  }
  await Promise.all(isler);
  return {
    frameW: fw, frameH: fh, scale: sheet.scale || 1, anchor: sheet.anchor || [fw / 2, fh - 1],
    peekVisible: sheet.peekVisible || 0.4, animations: sheet.animations,
    ciz(ctx, f, w, h) {
      const k = kaynaklar.get(anahtar(f));
      if (!k) return;
      ctx.imageSmoothingEnabled = !k.svg && sheet.pixelArt ? false : true; // piksel sanatı sayfası ("pixelArt": true) keskin kalsın
      if (k.svg) ctx.drawImage(k.img, 0, 0, w, h);
      else ctx.drawImage(k.img, k.sx, k.sy, fw, fh, 0, 0, w, h);
    },
  };
}
