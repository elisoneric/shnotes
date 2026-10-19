const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const logFile = path.join(path.dirname(process.execPath), "desktop.log");
function log(msg) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {}
}

log("Electron main process initializing...");

process.on("uncaughtException", (err) => {
  log(`Uncaught Exception: ${err.stack || err}`);
});
process.on("unhandledRejection", (err) => {
  log(`Unhandled Rejection: ${err.stack || err}`);
});

let activeWindow = null;
let currentAppVersion = null;

function getTargetUrl() {
  // 1. config.json next to executable
  try {
    const configPath = path.join(path.dirname(process.execPath), "config.json");
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (parsed.appUrl) {
        log(`Found appUrl in config.json: ${parsed.appUrl}`);
        return parsed.appUrl;
      }
    }
  } catch (err) {
    log(`Error reading config.json: ${err}`);
  }

  // 2. Environment variable
  if (process.env.APP_URL) {
    log(`Using APP_URL from env: ${process.env.APP_URL}`);
    return process.env.APP_URL;
  }

  // 3. Default fallback to production server
  log("Defaulting to https://note.esam.com.ng/app");
  return "https://note.esam.com.ng/app";
}

function createWindow() {
  log("Creating BrowserWindow...");
  const iconPath = path.join(__dirname, "icon.png");
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "ShNotes Enterprise Governance",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: "#09090b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    autoHideMenuBar: true,
    show: true,
  });

  activeWindow = win;

  const targetUrl = getTargetUrl();
  log(`Loading URL: ${targetUrl}`);
  win.loadURL(targetUrl);

  win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    log(`Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    if (errorCode === -102 || errorCode === -105 || errorCode === -106) {
      // Host not reachable yet, retry after 2 seconds
      setTimeout(() => {
        log("Retrying connection to " + validatedURL);
        win.loadURL(validatedURL);
      }, 2000);
    }
  });

  win.webContents.on("did-finish-load", () => {
    log("WebContents did-finish-load successfully");
    checkUpgrade();
  });

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
        log(`Server upgrade detected: ${serverVersion}. Purging cache and reloading...`);

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

  const upgradeInterval = setInterval(checkUpgrade, 30000);

  win.on("closed", () => {
    log("BrowserWindow closed");
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
  log("app.whenReady fired");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  log("app.on(window-all-closed) fired");
  if (process.platform !== "darwin") {
    app.quit();
  }
});
