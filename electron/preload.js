const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  triggerDesktopUpgradeRefresh: () => ipcRenderer.invoke("trigger-desktop-upgrade-refresh"),
});
