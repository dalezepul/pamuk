# Zepul yoldaş — masaüstü karakter prototipi (Pamuk)

Windows masaüstünde yaşayan, **uçan** (bacaksız) küçük bir yoldaş. Ekranın her yerinde süzülür, pencerelerin
kenarından bakar, arkalarına saklanır, iç köşelerinde oturur; olay olunca imlecin yanına gelip balonla bildirir.
Sessizdir: boşta saklı durur, tam ekran uygulamada (oyun/film) hiç görünmez.

## Kurulum ve çalıştırma

```
npm i          # yalnız electron
npm start      # tepsiye ikon gelir; karakter ekranda belirir
npm test       # birim testi (tam ekran algısı + boru iletisi doğrulaması)
```

Başlangıçta otomatik açılış kurulmaz.

## Tepsi menüsü

Göster/Gizle (`Ctrl+Alt+Z`) · Rahatsız etme · Sessiz kip · Etrafta dolaşsın · **Gösterim: 2D sprite / Gerçek zamanlı 3D** · Ciddi mod ·
Az hareket · Ten (volt / aura / auraGece) · Ölçek (0,75 / 1 / 1,5) · Test: Bildirim / Soru / Ajan bitti / Hata / Uyku /
Tırman / Saklan · Sprite seç (klasör) · Çıkış. Karakterin üstünde sağ tık aynı menüyü açar; sürükleyip bırakılabilir
(bırakıldığı yerde kalır).

## Ayarlar (`%APPDATA%\zepul-yoldas\ayarlar.json`)

```json
{ "sprite": "pamuk", "gosterim": "2d", "ten": "volt", "olcek": 1, "kose": "sag",
  "sessiz": true, "ciddi": false, "azHareket": false, "dolas": true, "uyku": [23, 7] }
```

`sprite`: `sprites/` altındaki ad ya da mutlak klasör yolu (yoksa `placeholder`'a düşer). `uyku`: gece saatleri
(başlangıç, bitiş); ayrıca 30 dk hareketsizlikte uyur. `dolas: false`: etrafta dolaşmaz, yan kenarda saklı kalır.

## Gösterim kipleri

| | 2D sprite | Gerçek zamanlı 3D |
|---|---|---|
| Çizim | `<canvas>` + `sprites/<ad>/sheet.json` | `renderer/3d/karakter.bundle.js` (three.js, global `Kivil`, `createZepul({ varyant:'yoldas', seffaf:true })`) |
| GPU | kapalı (`disableHardwareAcceleration`) | açık (WebGL) |
| Ten | SVG `:root{--ten;--vurgu;--dolgu}` değişkenleri değiştirilir (varsayılan tende PNG sayfası) | `setSkin(ten)` |
| Durum | animasyon adı | `setState`: idle/walk/… → `bosta`, think → `dusunuyor`, work → `dinliyor`, speak → `konusuyor`, wait → `onay-bekliyor`, error → `hata`, sleep → `uyku`, wave → `eylemde` |
| Boşta kare hızı | animasyonun fps'i (idle 4) | 10 fps, saklıyken 6 fps (modülün rAF'ı zamanlayıcıya indirilir); gizliyken 0 |

Geçiş canlıdır; yalnız 2D → 3D geçişinde uygulama kendini bir kez yeniden başlatır (GPU kararı süreç başında verilir).
3D → 2D doğrudan geçer.

## Davranış (uçuş modeli, `renderer/behavior.js`)

- **Süzülme:** yumuşak hızlanma/yavaşlama + hafif sinüs salınımı; kısa yatay `walk`, dikey `climb`, uzun geçiş `fly`
  (2D); 3D'de gidiş yönüne hafif eğim. Yerçekimi yok.
- **Dinlenme noktaları:** ekran köşesi, ön plan penceresinin **iç köşesi** (üst-sağ tercih: başlık çubuğunun ~32 px
  altı, sağdan 28 px; büyütülmüş pencerede de), pencerenin üst kenarı (sessiz değilse), ekranda pencerelerin kaplamadığı
  boş bir nokta.
- **Saklanma:** pencere kenarı (sol/sağ/üst) — karakterin pencere dikdörtgenine düşen kısmı `clip-path` (evenodd delik)
  ile çizilmez, kenardan yalnız kulak/gözler taşar (`peek_side` / `peek_top`); ekran yan kenarı (herhangi bir yükseklik,
  `peek`); ekranın altı (görev çubuğunun arkası). Pencere 1 sn'de bir izlenir: taşınınca birlikte kayar, kapanınca/
  küçülünce kırpma kalkar ve başka yere süzülür; iç köşedeyken pencere boyutu değişirse köşeye yeniden yerleşir.
- **Rutin:** görünür dinlenme (sessiz: 20 sn) → saklan → sessiz kipte 3–6 dk'da bir kısa orta-ekran süzülüşü → yine
  saklan. Çalışıyor/bekliyor/hata durumunda köşede görünür kalır (`work` / `wait` / `error`).
- **Dolaşma kapalı** ("Etrafta dolaşsın" işaretsiz): bulunduğu yüksekliğe en yakın yan kenara siner, durum ne olursa
  olsun orada kalır; yalnız olay (bildirim/soru) çıkarır, bitince yine kenara döner.
- **Olay:** saklandığı yerden çıkar, imlecin yanına (üstüne değil) gelir, el sallar, balon gösterir; tık ya da 20 sn
  (bildirimde `sure`) sonra geri döner. Sürükleme olayı keserse olay kuyruğa geri girer.
- **Bekleyen soru:** soru balonu ~20 sn cevaplanmazsa ve `sure` dolmadıysa (ya da `sure: 0`) küçülerek kapanır (patlamaz); Pamuk köşede
  görünür bekler (`wait`, dolaşma kapalıyken de), tepsi "bekliyor" ve menünün başında "Bekleyen soru: …". Pamuk'a
  tıklayınca (ya da menü maddesi) balon bulunduğu yerde yeniden açılır; birden çok soru sırayla (en çok 10). `sure`
  dolunca `null`. Soru yalnız düğmeyle cevaplanır (karaktere tık soruyu cevaplamaz); otomatik seçim yok.
- **Arka arkaya sorular:** düğmeyle cevaptan sonra Pamuk ve balon ~2,5 sn yerinde kalır (takip penceresi); bu sırada
  yeni soru gelirse balon kapanmadan içerik yerinde değişir (eskisi söner, yenisi belirir). Gelmezse balon patlar, Pamuk döner.
- **Uyku** gece/30 dk hareketsizlik; **rahatsız etme** ve **tam ekran** (ekranı tamamen kaplayan, büyütülmemiş,
  masaüstü olmayan ön plan penceresi) sırasında overlay gizlenir, olaylar (en çok 3) bekletilir.
- **Ciddi mod:** 2D'de `idle_serious` / `speak_serious`, 3D'de `setSerious(true)`.

## Balon

Karakterin üstünde (sığmazsa altında; imlecin üstüne gelirse yanında), kuyruğu karaktere bakar. Açılış: kuyruk
tarafından büyür (0,6 → 1, yaylanma, 260 ms), metin cümle cümle belirir; düğmeler 40 ms arayla gelir, hover'da
kalkar ve ısınır, tıkta basılır + dalga, seçilen yeşile döner ve diğerleri solar, 150 ms küçük "✓" görünür.
Kapanış (seçim, kapat, zaman aşımı) **patlama**: 90 ms şişme (1→1,06), gövde kaybolur, 6–8 parçacık (zemin rengi + ten
vurgusu, 5–10 px) saçılıp söner (220–280 ms), ince halka dalgası (1→1,4); karakter irkilir, seçimde el sallar (hata: `error`). Soru beklerken karakter `wait`, balon kenarı 2 sn'lik nabızla nefes alır.
Üstte küçük kaynak satırı: `konu` (ilk harf büyük; yoksa kaynak adı: "Zepul", "Claude Code", serbest), `sira` varsa
" · 2/3" ("Zepul-ai · 1/3"); tepsideki "Bekleyen soru: …" aynı etiketi kullanır. Nokta: Zepul ten rengi,
Claude Code `#d97757`, diğeri nötr; yoksa yer kaplamaz). 3–5 düğme iki sütuna sarar; 20 karakterden uzun etiket varsa her düğme kendi satırında (balon en çok 300 px).
Açık/koyu sistem temasına göre pastel zemin, Pamuk'un ten rengi vurgu, küçük SVG ikonlar (soru/bilgi/uyarı/tamam).
`prefers-reduced-motion` ya da "Az hareket" ayarında animasyonlar anında.

## Sprite sözleşmesi (`sprites/<ad>/sheet.json`)

```json
{ "frameW": 256, "frameH": 256, "scale": 0.25, "anchor": [128, 244], "peekVisible": 0.4, "peekTop": 0.66,
  "svgFrames": ["idle-1.svg", "…"], "image": "sheet.png", "image1x": "sheet@1x.png",
  "tint": "volt", "tints": { "volt": { "ten": "#4FB3FF", "vurgu": "#8A4DFF", "dolgu": "#7fa6ff" } },
  "animations": { "idle": { "frames": [0, 1, 2], "fps": 4, "loop": true }, "…": {} } }
```

- Kareler **sağa bakar** (sola bakış motorda aynalanır). `anchor`: karenin alt-orta noktası (piksel).
- `svgFrames` varsa `frames` bu listeye indekstir (ya da doğrudan dosya adı); yoksa `image` sayfasındaki hücre
  indeksidir (soldan sağa, yukarıdan aşağı).
- `peekVisible`: ekran/pencere yan kenarından bakarken görünen genişlik oranı (`peek`, `peek_side` karelerinde yüz
  karenin sağ tarafında). `peekTop`: alttan/üstten saklanırken görünen üst oran.
- Animasyonlar: `idle walk climb fly peek peek_side peek_top hide sit wave think work speak wait error sleep`
  (+ isteğe bağlı `idle_serious speak_serious`). Eksik olanın yedeği: fly/climb → walk, peek_side → peek,
  peek_top → idle.
- `icons/`: `tepsi-renkli[-calisiyor|-bekliyor|-hata]-32.png` (tepsi, dört durum), `avatar-64.png` (balon). Yoksa
  `icons/tray.png` + durum noktası, o da yoksa idle karesinden üretilir.
- Yer tutucu: `sprites/placeholder/` (`node sprites/placeholder/uret.mjs` ile yeniden üretilir).

## Zepul'e bağlama (yerel boru, ağ portu yok)

`\\.\pipe\zepul-yoldas` adlandırılmış borusuna satır başına bir JSON:

```json
{ "tip": "bildirim", "metin": "Ajan bitti", "alt": "bitti" }
{ "tip": "soru", "metin": "Kaydedeyim mi?", "secenekler": ["Onayla", "Reddet"] }
{ "tip": "durum", "metin": "calisiyor" }
{ "tip": "soru", "kaynak": "claude", "konu": "ZEPUL Site", "sira": "1/2", "metin": "Devam edeyim mi?", "secenekler": ["Evet", "Hayır", "Sonra"], "sure": 0 }
{ "tip": "iptal", "cevapKanali": "zepul:z1a2b3" }
```

Alanlar: `secenekler` en çok 5 × 1–40 karakter; `kaynak` `zepul` | `claude` | serbest (≤24); `konu` ≤40; `sira` "2/3" (1–2 hane / 1–2 hane);
`sure` bildirimde 5–1800 sn (balon açık kalma, varsayılan 20), soruda 0 = süresiz ya da 5–86400 sn (soru bu kadar bekler, varsayılan 20); `cevapKanali` `zepul:z…` ya da `soru:s…`. Sınır dışı alan → `{"hata":"…"}`.
`cevapKanali` yoksa cevap sokete döner ve soket cevaptan önce kapanırsa soru düşer (balon sessizce kapanır); varsa
cevap Zepul'e gider, soket kapanması soruyu düşürmez, `iptal` o kanalın sorusunu düşürür.
Yanıt tek satır: `{"cevap":"Onayla"}` (zaman aşımında `null`), `durum`/`iptal` için `{"ok":true}`. `alt: "hata"` hata
görünümü verir. Örnek: `node ornek-gonder.mjs "Merhaba"`, `--soru "Devam?" Evet Hayır`, `--durum calisiyor`,
`--hata "…"`, `--bitti "…"`. Zepul tarafında aynı `net.connect('\\\\.\\pipe\\zepul-yoldas')` yeterli.

Geliştirme kancaları (`tip: "test"`): `orta`, `ic`, `batir`, `saklan`, `alt`, `kose`, `uyku`, `balon`, `2d`, `3d`;
`YOLDAS_CEKIM=<klasör>` ortam değişkeniyle başlatılırsa `cek:<ad>` overlay içeriğini (yalnız kendi penceresini) PNG
olarak kaydeder.


## Dosyalar

```
main.cjs        overlay penceresi, tepsi, kısayol, ayarlar, GPU kararı, boru API'si bağlantısı
pencere.cjs     ön plan/izlenen pencere takibi (tek uzun ömürlü PowerShell, user32/dwmapi) + tamEkranMi()
yoldas.cjs      \\.\pipe\zepul-yoldas sunucusu ve ileti doğrulaması
preload.cjs     renderer köprüsü (window.yoldas)
renderer/       index.html (balon CSS), sprite.js (SVG/PNG sayfa), behavior.js (davranış + çizim), 3d/ (Kivil + geçici ikonlar)
sprites/        pamuk/ (Pamuk 2D seti), placeholder/
ornek-gonder.mjs, test.cjs
```

## Bilinen sınırlar

- Tek (birincil) ekran. Yalnız ön plan / izlenen pencere bilinir; onu örten diğer pencereler hesaba katılmaz.
- Overlay çalışma alanından her kenarda 1 px küçüktür: monitörü tam kaplayan her-zaman-üstte pencereyi Windows tam ekran
  uygulama sayar ve otomatik gizli görev çubuğu fareyle açılmaz.
- Overlay çalışma alanı boyutunda saydam bir penceredir; her kare güncellemesi tüm katmanlı pencereyi yeniden birleştirir
  — 3D'de boşta CPU'nun asıl kaynağı bu. Sonraki adım: karakter boyutunda küçük bir pencereyi taşımak.
- Pencere takibi 1 sn aralıklı (taşırken karakter ~1 sn geriden gelir).
- 2D'de varsayılan dışı ten için 69 SVG çözülür (bellek artar); varsayılan tende PNG sayfası kullanılır.
