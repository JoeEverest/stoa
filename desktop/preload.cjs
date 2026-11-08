// Runs in the app window only (not in lesson frames). Gives setup and Settings the few things that
// need the desktop shell. Types: web/src/desktop.d.ts.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stoaDesktop", {
  platform: process.platform,
  /** name: "anthropic" (API key), "custom" (endpoint token) or "bedrock" (Bedrock API key). */
  setSecret: (name, value) => ipcRenderer.invoke("stoa:set-secret", name, value),
  clearSecret: (name) => ipcRenderer.invoke("stoa:clear-secret", name),
  secretInfo: () => ipcRenderer.invoke("stoa:secret-info"),
  openClaudeLogin: (cliPath) => ipcRenderer.invoke("stoa:open-claude-login", cliPath),
  openLogs: () => ipcRenderer.invoke("stoa:open-logs"),
  updates: {
    status: () => ipcRenderer.invoke("stoa:update-status"),
    check: () => ipcRenderer.invoke("stoa:update-check"),
    download: () => ipcRenderer.invoke("stoa:update-download"),
    install: () => ipcRenderer.invoke("stoa:update-install"),
    setAuto: (on) => ipcRenderer.invoke("stoa:update-auto", on),
    openReleasePage: () => ipcRenderer.invoke("stoa:update-release-page"),
    /** Calls back with each new status; returns a function that stops it. */
    onStatus: (cb) => {
      const handler = (_e, s) => cb(s);
      ipcRenderer.on("stoa:update-status", handler);
      return () => ipcRenderer.removeListener("stoa:update-status", handler);
    },
  },
});
