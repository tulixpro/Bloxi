const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

let serverProcess;
let mainWindow;

function waitForServer(url, attempts = 40) {
  return new Promise((resolve, reject) => {
    const check = remaining => {
      const request = http.get(url, response => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (remaining <= 0) return reject(new Error("Bloxi-Server konnte nicht gestartet werden."));
        setTimeout(() => check(remaining - 1), 250);
      });
    };
    check(attempts);
  });
}

async function createWindow() {
  serverProcess = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: "3210", ELECTRON_RUN_AS_NODE: "1" },
    stdio: "ignore"
  });
  try {
    await waitForServer("http://127.0.0.1:3210/api/status");
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 820,
      minWidth: 900,
      minHeight: 620,
      backgroundColor: "#101326",
      title: "Bloxi",
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    mainWindow.loadURL("http://127.0.0.1:3210/client.html");
  } catch (error) {
    dialog.showErrorBox("Bloxi konnte nicht starten", error.message);
    app.quit();
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});