// Renderer'a dar köprü (window.yoldas). Node/Electron nesnesi geçmez.
const { contextBridge, ipcRenderer } = require('electron');
const yolla = (k) => (...a) => ipcRenderer.send(k, ...a);
const OLAYLAR = ['ayar', 'sprite', 'pencere', 'olay', 'gorunur', 'uyku', 'komut', 'durum', 'dusur'];
contextBridge.exposeInMainWorld('yoldas', {
  hazir: yolla('hazir'), fare: yolla('fare'), menu: yolla('menu'), ikonlar: yolla('ikonlar'),
  cevap: yolla('cevap'), takip: yolla('takip'),
  imlec: () => ipcRenderer.invoke('imlec'), // imleç konumu (overlay koordinatı)
  on: (ad, f) => { if (OLAYLAR.includes(ad)) ipcRenderer.on(ad, (_e, ...a) => f(...a)); },
});
