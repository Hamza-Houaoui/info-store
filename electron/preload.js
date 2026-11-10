const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printWindow: () => ipcRenderer.invoke('print-window'),
  isDesktop: true
});
