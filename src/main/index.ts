import { app, BrowserWindow, ipcMain, safeStorage, session } from 'electron'
import { join } from 'node:path'
import { createAppServices, type AppServices } from './app-services'
import { buildContentSecurityPolicy } from './content-security-policy'
import { registerIpc } from './ipc/register'
import { createElectronSafeStorage } from './settings/safe-storage'
import { createBrowserWindowOptions } from './window-options'

app.setName('Japanese Learning Assistant')

let services: AppServices | undefined

function createWindow(): void {
  const mainWindow = new BrowserWindow(
    createBrowserWindowOptions(join(__dirname, '../preload/index.js')),
  )

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function contentSecurityPolicy(): string {
  return buildContentSecurityPolicy(Boolean(process.env.ELECTRON_RENDERER_URL))
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy()],
      },
    })
  })

  services = createAppServices({
    userDataDir: app.getPath('userData'),
    safeStorage: createElectronSafeStorage(safeStorage),
    appRoot: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
  })
  console.log('JLA_STARTUP_DB_OK')
  registerIpc(ipcMain, services)
  if (process.env.JLA_SMOKE === '1') {
    app.quit()
    return
  }
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  services?.close()
})
