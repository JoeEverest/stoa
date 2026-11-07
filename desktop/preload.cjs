// Runs in the app window only (not in lesson frames). Gives the setup screen the few things that
// need the desktop shell. Types: web/src/desktop.d.ts.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stoaDesktop", {
  platform: process.platform,
  setApiKey: (key) => ipcRenderer.invoke("stoa:set-api-key", key),
  clearApiKey: () => ipcRenderer.invoke("stoa:clear-api-key"),
  openLogs: () => ipcRenderer.invoke("stoa:open-logs"),
});
