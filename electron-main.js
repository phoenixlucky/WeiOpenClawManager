const path = require("path");
const { app, BrowserWindow, dialog, shell } = require("electron");
const { startServer } = require("./server");

let mainWindow = null;
let serverRuntime = null;

function getWindowIcon() {
  const iconPath = path.join(__dirname, "build", "icon.png");
  return iconPath;
}

function createMainWindow(baseUrl) {
  const window = new BrowserWindow({
    width: 1360,
    height: 920,
    minWidth: 1080,
    minHeight: 760,
    backgroundColor: "#f3f0e8",
    autoHideMenuBar: true,
    icon: getWindowIcon(),
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.loadURL(baseUrl);
  return window;
}

async function bootstrap() {
  serverRuntime = await startServer({
    port: 4173,
    openClient: false
  });

  mainWindow = createMainWindow(serverRuntime.url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(bootstrap).catch(async (error) => {
  const message = error && error.message ? error.message : String(error);
  console.error(message);
  await dialog.showMessageBox({
    type: "error",
    title: "尉龙虾OpenClaw配置管理",
    message: "桌面壳启动失败",
    detail: message
  });
  app.quit();
});

app.on("window-all-closed", async () => {
  if (serverRuntime) {
    try {
      await serverRuntime.close();
    } catch {
      // ignore close failure during shutdown
    }
    serverRuntime = null;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length > 0) {
    return;
  }

  if (!serverRuntime) {
    serverRuntime = await startServer({
      port: 4173,
      openClient: false
    });
  }

  mainWindow = createMainWindow(serverRuntime.url);
});
