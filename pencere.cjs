// Ön plan penceresi takibi: tek uzun ömürlü PowerShell süreci (user32/dwmapi), stdin'e satır yaz → stdout'tan tek satır JSON al.
// Her satır isteği: izlenen (oturulan) pencerenin HWND'si ya da 0. Yanıt: {"on":{…},"takip":{…}} — dikdörtgenler FİZİKSEL piksel.
const { spawn } = require('node:child_process');
const readline = require('node:readline');

const CS = String.raw`
using System; using System.Text; using System.Runtime.InteropServices;
public static class YW {
  public struct R { public int L, T, Rt, B; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out R r, int n);
  public static string Bilgi(IntPtr h) {
    if (h == IntPtr.Zero || !IsWindow(h)) return "null";
    R r; if (DwmGetWindowAttribute(h, 9, out r, 16) != 0) GetWindowRect(h, out r);
    var s = new StringBuilder(128); GetClassName(h, s, 128);
    return "{\"h\":" + h.ToInt64() + ",\"r\":[" + r.L + "," + r.T + "," + r.Rt + "," + r.B + "],\"z\":" + (IsZoomed(h) ? 1 : 0)
      + ",\"i\":" + (IsIconic(h) ? 1 : 0) + ",\"v\":" + (IsWindowVisible(h) ? 1 : 0)
      + ",\"c\":\"" + s.ToString().Replace("\\", "").Replace("\"", "") + "\"}";
  }
}`;
const PS = `$ErrorActionPreference='Stop'; Add-Type -TypeDefinition @'\n${CS}\n'@
[void][YW]::SetProcessDpiAwarenessContext([IntPtr](-4))
while ($null -ne ($l = [Console]::In.ReadLine())) {
  $t = [IntPtr][long]$l
  [Console]::Out.WriteLine('{"on":' + [YW]::Bilgi([YW]::GetForegroundWindow()) + ',"takip":' + [YW]::Bilgi($t) + '}')
  [Console]::Out.Flush()
}`;

// Masaüstü/kabuk pencereleri: tam ekran sayılmaz, üstüne tırmanılmaz.
const KABUK = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', '#32768', 'NotifyIconOverflowWindow',
  'TopLevelWindowForOverflowXamlIsland', 'Windows.UI.Core.CoreWindow', 'XamlExplorerHostIslandWindow']);

// r: [sol, üst, sağ, alt] fiziksel; ekran: {x, y, width, height} fiziksel. Pencere ekranı tamamen kaplıyorsa ve kabuk değilse tam ekran.
function tamEkranMi(bilgi, ekran) {
  // Büyütülmüş (IsZoomed) pencere tam ekran sayılmaz: görev çubuğu otomatik gizliyken o da ekranı kaplar.
  if (!bilgi || !bilgi.v || bilgi.i || bilgi.z || KABUK.has(bilgi.c)) return false;
  const [l, t, r, b] = bilgi.r;
  return l <= ekran.x && t <= ekran.y && r >= ekran.x + ekran.width && b >= ekran.y + ekran.height;
}

// Süreci başlatır; sor(hwnd) → Promise<yanıt>. Süreç ölürse 5 sn sonra yeniden açılır.
function takipci() {
  let ps = null, bekleyen = null;
  const ac = () => {
    ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand',
      Buffer.from(PS, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    readline.createInterface({ input: ps.stdout }).on('line', (s) => {
      const b = bekleyen; bekleyen = null;
      try { b?.coz(JSON.parse(s)); } catch { b?.coz(null); }
    });
    ps.on('exit', () => { bekleyen?.coz(null); bekleyen = null; ps = null; if (!kapali) setTimeout(ac, 5000); });
    ps.stdin.on('error', () => {});
  };
  let kapali = false;
  ac();
  return {
    sor(hwnd) {
      if (!ps || bekleyen) return Promise.resolve(null);
      return new Promise((coz) => { bekleyen = { coz }; ps.stdin.write(`${hwnd || 0}\n`); });
    },
    kapat() { kapali = true; ps?.kill(); },
  };
}

// Çalışma alanından 1 px küçük overlay dikdörtgeni (bkz. main.cjs alan()).
const overlayAlani = (wa) => ({ x: wa.x + 1, y: wa.y + 1, width: wa.width - 2, height: wa.height - 2 });

module.exports = { takipci, tamEkranMi, KABUK, overlayAlani };
