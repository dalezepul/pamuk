# Pamuk — 2D sprite seti notları

3D karakterin (`zepul-ai-konsept/karakter/`) vektör karşılığı. Kaynak tek yerde: `kare-uret.mjs` parçalardan (`pamuk.master.svg`'deki semboller) 69 kareyi, `sheet.json`'u, ikon SVG'lerini ve `onizleme.html`'i üretir; `png-uret.mjs` başsız Chrome ile PNG sayfaları, ikon/avatar PNG'lerini ve kontrol görüntülerini çıkarır.

```
node kare-uret.mjs [--ten volt|aura|auraGece] [çıktı klasörü …]   # SVG + json + html
node png-uret.mjs [--port 9620] [--sadece sayfa|ikon|kareler|ekran]  # PNG'ler (kendi Chrome'unu açar, yalnız o PID'yi kapatır)
```

## Kimlik kuralları

| Öğe | Değer |
|---|---|
| Gövde | küre r 36 (128 viewBox), radyal gradyan `#ffffff` → `#f3eee8` (.48) → `#cdc1b6` (.84) → `#b9ada2`; ışık **sol üst** (parlama elipsi 46,55) |
| Rim ışığı | sağ-alt kenarda ten rengi yay (3 px, %55); sol-altta `--dolgu` yayı (2 px, %35) |
| Kulaklar | r 11, gövde gradyanı; iç daire r 6,2 ten rengi %80 + küçük beyaz parlama |
| Gözler | merkezler (±14, −8); kenar halkası `#cdb9ab` r 12; kubbe `#2d2538` → `#14101a`; iris halkası ten rengi 2,4 px r 6,3; çift yansıma (büyük elips sol-üst, küçük nokta sağ-alt) |
| Göz kapağı | gövde renginde üst kapak, kenar çizgisi `#cdb9ab` 1,8 px; `kapak` 0–1, `egim` + iç uç aşağı (ciddi), − iç uç yukarı (endişe); ≥ .95 kapalı = gülen çizgi |
| Allık | `#ff9fb4` radyal, (±24, +2), %50 (hata %90, ciddi %30) |
| Ağız | `#3b2433` 1,9 px: gulumse · duz · o · O · uzgun |
| Kollar | kapsül 8,5×11 + el r 5, gövde gradyanı, iç kenar `#cdc1b6`; pivot (±31, +6); açı 0 sarkık, 90 yana, 160 yukarı, − içe |
| Karın ışığı | elips 15×8,5 (0, +22), durum rengi radyal; `karin` yoğunluğu .3 (uyku) – 1.25 (uçuş) |
| Kontur + hale | SVG filtresi `#h`: `#2b2530` %78 dilate 1,3 + beyaz %55 dilate 3,2 blur .9 → koyu, açık, fotoğrafik zeminde okunur |
| Gölge | taban elipsi `#000` %20; havadayken küçülür/solar; climb/fly'da yok |

**Durum renkleri** (`sheet.json → statusColors`): bosta `--ten` · düşünüyor `--vurgu` · onay `#FFC24D` · hata `#FF3B3B` · uyku `--ten` loş · ciddi `#4FB3FF`.

**Tenler** (`sheet.json → tints`; SVG'de `:root{--ten;--vurgu;--dolgu}` ve `.t/.ts/.v/.ds` sınıfları):

| Ten | --ten | --vurgu | --dolgu |
|---|---|---|---|
| volt (varsayılan) | `#4FB3FF` | `#8A4DFF` | `#7fa6ff` |
| aura | `#1FC9BD` | `#9B6DFF` | `#bfe6ff` |
| auraGece | `#35E6A0` | `#8E5BFF` | `#6fe0b8` |

Satır içi (inline) SVG'de sayfa değişkeni geçerli olur; `<img>`/canvas yoluyla yüklenince SVG'nin kendi varsayılanı (üretim anındaki `--ten`) kullanılır → başka ten için `--ten aura` ile yeniden üret.

## Kare listesi ve zamanlama

Kareler **sağa** bakar (sola bakış motor flip'i). Çapa alt-orta: `[64,122]` (128) = `[128,244]` (256). Dizi indeksleri `sheet.json`'da; `[1,2,3,2]` tarzı ping-pong diziler döngü atlamasını önler.

| Anim | Kare | fps | Döngü | Not |
|---|---|---|---|---|
| idle | 6 | 4 | ✓ | nefes (sy 1→1.03), 5. kare kırpma, 6. bakış |
| walk | 8 | 8 | ✓ | **yatay süzülme**: bob −8…−12, gövde 5° eğik, kollar geride, karın ışığı 3 puf iz |
| hop | 8 | 10 | ✓ | isteğe bağlı sekme: ezilme .9 → uzama 1.12 → tepe −22 → iniş .88 |
| climb | 4 | 6 | ✓ | dikey süzülme, duvar sağda (dx +24), kollar yukarı, karın ışığı güçlü, iz aşağı |
| fly | 4 | 10 | ✓ | hızlı geçiş: 14° eğik, dy −12, kulaklar geride, 3 puf iz |
| peek | 3 | 2 | ✓ | ekran kenarı: yüz sağa dönük (+6), dx +26, yalnız x ≥ 77 görünür |
| peek_side | 3 (+1) | 3 | ✓ | pencere yan kenarı: dx 20→26→30 giderek uzanır (ping-pong) |
| peek_top | 3 | 2 | ✓ | pencere üst kenarı: eller kenarda (150°), bakış yukarı / kırpma / yana |
| hide | 3 | 8 | ✗ | ezilerek kayış: sx 1.06→1.22, sy .94→.76, kapak .5; son karede kalır |
| sit | 3 (+1) | 2 | ✓ | kollar 12 px aşağı sarkık, −8°/2°/12° sallanma (ping-pong) |
| wave | 4 | 8 | ✓ | sağ kol 150/172/150/125°, kol yüzün önünde |
| think | 3 (+1) | 3 | ✓ | kol çeneye, bakış yukarı, 1→3 nokta, mor karın |
| work | 4 | 8 | ✓ | minik ekran (46,94 36×24), kollar içe, satırlar 1→4 |
| speak | 3 (+1) | 8 | ✓ | ağız gulumse → o → O, karın nabzı |
| wait | 2 | 3 | ✓ | baş 7° eğik, kaş yukarı, amber karın, sarı yay 0°/180° |
| error | 2 | 4 | ✓ | kabarma 1.08, ±2.5 px titreme, kapak .6 endişeli, kırmızı karın, "!" |
| sleep | 2 | 1.5 | ✓ | kapak kapalı, kulaklar düşük, karın %30, z / zZ |
| idle_serious | 2 | 2 | ✓ | kapak .42 iç uç aşağı, düz ağız, sakin mavi |
| speak_serious | 2 | 6 | ✓ | aynı + ağız duz/o |

Toplam 69 SVG; sayfa 8 sütun × 9 satır (`sheet.png` 2048×2304 @2x, `sheet@1x.png` 1024×1152).

## Motor için öneriler

- `sheet.json`: `frameW/H 256`, `scale .25` → ekranda 64 px (placeholder ile aynı boy). `svgFrames` varken motor SVG kullanır; PNG'ye geçmek için `svgFrames` anahtarını kaldır (`image: sheet.png`, 256 px hücre; @1x için `frameW/H 128`, `scale .5`, `anchor [64,122]`, `image: sheet@1x.png`).
- **Süzülme yüksekliği:** walk'ta gövde tabanı çapadan 8–12 px yukarıda (gölge yerde kalır). Motor hızı ~55 px/sn için 8 fps uygun; hızlı geçişte `fly` + 2× hız.
- **Tüneme çapası (sit):** çapa pencere üst kenarına; kollar kenarın 12 px altına sarkar (pencere üstüne çizilir, sorun değil). `peekTop .66` → `pencereyeBat` yalnız kulak + gözleri bırakır (ağız gizlenir).
- **Peek ofseti:** `peekVisible .4` → 64 px'te 25,6 px görünür; yüz +6 px kenara kaydığı için iki göz de görünür. Pencere kenarı için `peek_side` (yan) ve `peek_top` (üst) karelerini motor kırpmayla (`kirp`) kullanın.
- **Ciddi:** `idle_serious` / `speak_serious` varsa motor `ciddi` bayrağında bunları seçsin; diğer durumlarda normal kare.
- **Dikey kenar (climb):** duvar karenin sağında; gövde merkezi x 88; sola tırmanış flip ile.
- 48 px altında allık ve ağız kaybolur ama gözler + kulaklar okunur (bkz. `ekran/onizleme-serit.png`). 32 px ve altı için `icons/` kullanın.

## Dosyalar

`*.svg` kareler · `sheet.json` · `sheet.png` / `sheet@1x.png` · `pamuk.master.svg` · `icons/` (tepsi-acik / tepsi-koyu / tepsi-renkli ± calisiyor/bekliyor/hata rozetleri, 16/24/32 PNG + SVG; avatar.svg, avatar-64/128.png) · `onizleme.html` · `kare-uret.mjs` · `png-uret.mjs` · `ekran/` (yalnız konsept klasöründe: kontak sayfası ve önizleme görüntüleri).
