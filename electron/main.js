const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let activeWindow = null;
let currentAppVersion = null;

function getTargetUrl() {
  // 1. Environment variable
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // 2. config.json next to executable or in electron directory
  try {
    const candidates = [
      path.join(path.dirname(process.execPath), "config.json"),
      path.join(__dirname, "config.json"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (parsed.appUrl) return parsed.appUrl;
      }
    }
  } catch (err) {}

  // 3. Default fallback
  return "http://localhost:3000/app";
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "ShNotes Enterprise Governance",
    backgroundColor: "#09090b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    autoHideMenuBar: true,
  });

  activeWindow = win;

  const targetUrl = getTargetUrl();
  console.log(`[ShNotes Desktop] Loading application: ${targetUrl}`);
  win.loadURL(targetUrl);

  // Periodic server upgrade detector for native desktop window
  const baseUrl = targetUrl.split("/app")[0];
  const versionUrl = `${baseUrl}/api/version`;

  const checkUpgrade = async () => {
    try {
      const response = await fetch(versionUrl, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const serverVersion = data.version;

      if (!serverVersion) return;

      if (!currentAppVersion) {
        currentAppVersion = serverVersion;
        return;
      }

      // If server version changed, perform desktop hard cache purge & reload
      if (serverVersion !== currentAppVersion) {
        currentAppVersion = serverVersion;
        console.log(`[ShNotes Desktop] Server upgrade detected: ${serverVersion}. Purging cache and reloading...`);

        // Purge session HTTP cache and ServiceWorker caches
        await win.webContents.session.clearCache();
        await win.webContents.session.clearStorageData({
          storages: ["cachestorage", "serviceworkers"],
        });

        // Hard refresh ignoring browser cache
        win.webContents.reloadIgnoringCache();
      }
    } catch (err) {
      // Offline or network error; keep existing state
    }
  };

  // Run version check after page load, then poll every 30s
  win.webContents.on("did-finish-load", () => {
    checkUpgrade();
  });

  const upgradeInterval = setInterval(checkUpgrade, 30000);

  win.on("closed", () => {
    clearInterval(upgradeInterval);
    activeWindow = null;
  });
}

// IPC endpoint allowing renderer to trigger native hard refresh
ipcMain.handle("trigger-desktop-upgrade-refresh", async () => {
  if (activeWindow) {
    await activeWindow.webContents.session.clearCache();
    await activeWindow.webContents.session.clearStorageData({
      storages: ["cachestorage", "serviceworkers"],
    });
    activeWindow.webContents.reloadIgnoringCache();
    return { success: true };
  }
  return { success: false };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
