import { app, BrowserWindow, ipcMain, shell, dialog, nativeImage, Notification, Menu } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { TmuxManager } from './tmux'
import { BookmarkStore } from './bookmarks'
import { scanProjects } from './projects'
import { SettingsStore, type Settings } from './settings'
import type { CreateSessionOpts, ImportSessionOpts } from './types'

const isDev = !app.isPackaged

app.setName('EasyClaude')

const ICON_PATH = isDev
  ? join(__dirname, '../../build/icon.png')
  : join(process.resourcesPath, 'icon.png')

if (process.platform === 'darwin' && isDev && existsSync(ICON_PATH)) {
  try {
    app.dock?.setIcon(nativeImage.createFromPath(ICON_PATH))
  } catch {
    /* dock icon set may fail before app ready; retry inside whenReady */
  }
}

let mainWindow: BrowserWindow | null = null
const manager = new TmuxManager()
const bookmarks = new BookmarkStore()
const settings = new SettingsStore()

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0b10',
    show: false,
    icon: existsSync(ICON_PATH) ? ICON_PATH : undefined,
    title: 'EasyClaude',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function wireIpc(): void {
  ipcMain.handle('tmux:list', () => manager.list())

  ipcMain.handle('tmux:create', async (_e, opts: CreateSessionOpts) => {
    return manager.create(opts)
  })

  ipcMain.handle('tmux:list-external', () => manager.listExternal())

  ipcMain.handle('tmux:import', async (_e, opts: ImportSessionOpts) => {
    return manager.import(opts)
  })

  ipcMain.handle('tmux:kill', async (_e, id: string) => {
    await manager.kill(id)
    bookmarks.removeAllForSession(id)
  })

  ipcMain.handle('tmux:attach', async (_e, id: string, cols: number, rows: number) => {
    await manager.attach(id, cols, rows)
  })

  ipcMain.handle('tmux:detach', async (_e, id: string) => {
    await manager.detach(id)
  })

  ipcMain.handle('tmux:write', (_e, id: string, data: string) => {
    manager.write(id, data)
  })

  ipcMain.handle('tmux:send-text', async (_e, id: string, text: string) => {
    await manager.sendText(id, text)
  })

  ipcMain.handle('tmux:resize', (_e, id: string, cols: number, rows: number) => {
    manager.resize(id, cols, rows)
  })

  ipcMain.handle('tmux:rename', (_e, id: string, name: string) => {
    manager.rename(id, name)
  })

  ipcMain.handle('tmux:set-color', (_e, id: string, color: string) => {
    manager.setColor(id, color)
  })

  ipcMain.handle('tmux:reorder', (_e, orderedIds: string[]) => {
    manager.reorder(orderedIds)
  })

  ipcMain.handle('tmux:get-statuses', () => manager.getStatuses())

  ipcMain.handle('tmux:capture-live', (_e, id: string) => manager.captureLive(id))

  ipcMain.handle('dialog:pick-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: app.getPath('home')
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('bookmarks:list', (_e, sessionId: string) => bookmarks.list(sessionId))

  ipcMain.handle(
    'bookmarks:create',
    async (_e, sessionId: string, label: string) => {
      let snapshot = ''
      try {
        snapshot = await manager.captureSnapshot(sessionId, 60)
      } catch {
        snapshot = ''
      }
      return bookmarks.create(sessionId, label, snapshot)
    }
  )

  ipcMain.handle('bookmarks:delete', (_e, id: string) => {
    bookmarks.remove(id)
  })

  ipcMain.handle('projects:scan', () => scanProjects())

  ipcMain.handle('settings:get', () => settings.get())
  ipcMain.handle('settings:save', (_e, next: Partial<Settings>) => settings.save(next))

  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:open-external', (_e, url: string) => shell.openExternal(url))

  ipcMain.handle('app:open-file', async (_e, opts: { path: string; line?: number; col?: number; cwd?: string; ide?: string }) => {
    const { resolve, isAbsolute } = await import('node:path')
    const abs = isAbsolute(opts.path)
      ? opts.path
      : resolve(opts.cwd || app.getPath('home'), opts.path)
    const ide = opts.ide || 'cursor'
    const lineCol = opts.line ? `:${opts.line}${opts.col ? `:${opts.col}` : ''}` : ''
    if (ide === 'finder') {
      shell.showItemInFolder(abs)
      return
    }
    const url = `${ide}://file${abs}${lineCol}`
    shell.openExternal(url)
  })

  ipcMain.handle('notify:awaiting', (_e, sessionId: string, sessionName: string) => {
    const s = settings.get()
    if (!s.notifications.systemNotifications) {
      if (process.platform === 'darwin') app.dock?.bounce('critical')
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
        mainWindow.flashFrame(true)
      }
      return
    }
    if (Notification.isSupported()) {
      const n = new Notification({
        title: 'Claude is awaiting input',
        body: sessionName,
        silent: true
      })
      n.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('notification:click', sessionId)
        }
        app.focus({ steal: true })
      })
      n.show()
    }
    if (process.platform === 'darwin') {
      app.dock?.bounce('critical')
    }
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
      mainWindow.flashFrame(true)
    }
  })

  const safeSend = (channel: string, ...args: unknown[]): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const wc = mainWindow.webContents
    if (wc.isDestroyed()) return
    wc.send(channel, ...args)
  }

  manager.on('data', (id: string, data: string) => safeSend('tmux:data', id, data))
  manager.on('exit', (id: string) => safeSend('tmux:exit', id))
  manager.on('status', (id: string, status: string) => {
    safeSend('tmux:status', id, status)
    updateBadgeCount()
  })
}

function updateBadgeCount(): void {
  if (process.platform !== 'darwin') return
  const statuses = manager.getStatuses()
  const count = Object.values(statuses).filter((s) => s === 'awaiting').length
  try {
    app.setBadgeCount(count)
  } catch {
    /* ignore */
  }
}

function buildAppMenu(): void {
  const send = (action: string): void => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('menu:action', action)
    }
  }
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'EasyClaude',
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings…',
                accelerator: 'CmdOrCtrl+,',
                click: () => send('settings')
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Session…', accelerator: 'CmdOrCtrl+N', click: () => send('new-session') },
        { label: 'Import Existing tmux…', click: () => send('import-session') },
        { type: 'separator' },
        {
          label: 'Bookmark Current Point',
          accelerator: 'CmdOrCtrl+B',
          click: () => send('bookmark')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        {
          label: 'Command Palette…',
          accelerator: 'CmdOrCtrl+K',
          click: () => send('palette-all')
        },
        {
          label: 'Switch Session…',
          accelerator: 'CmdOrCtrl+P',
          click: () => send('palette-sessions')
        },
        {
          label: 'Find in Terminal…',
          accelerator: 'CmdOrCtrl+F',
          click: () => send('search')
        },
        { type: 'separator' },
        { label: 'Toggle Bookmarks Panel', click: () => send('toggle-bookmarks') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        { label: 'EasyClaude Help', click: () => send('help') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && existsSync(ICON_PATH)) {
    try {
      app.dock?.setIcon(nativeImage.createFromPath(ICON_PATH))
    } catch {
      /* ignore */
    }
  }
  await manager.init()
  wireIpc()
  await createWindow()
  buildAppMenu()

  if (!isDev) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('update-downloaded', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:downloaded')
      }
    })
    autoUpdater.checkForUpdatesAndNotify().catch(() => undefined)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  await manager.dispose()
})
