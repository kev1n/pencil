// Gives the page the same doorway the Mac app's window has: one message
// handler that answers the NUSession calls (see src/platform/native.ts).
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("webkit", {
  messageHandlers: {
    pencil: { postMessage: (message) => ipcRenderer.invoke("pencil", message) }
  }
});
// What the app calls the thing it runs on.
contextBridge.exposeInMainWorld("pencilDevice", "computer");
