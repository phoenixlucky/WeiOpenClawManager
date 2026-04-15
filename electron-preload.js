const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("openclawDesktop", {
  shell: "electron"
});
