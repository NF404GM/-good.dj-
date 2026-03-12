import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { getCachedLicense, verifyLicense, clearLicense, needsRevalidation } from './license.ts';
import { setupIpcHandlers } from './ipcHandlers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── CONFIGURATION ──
// Replace this with your actual Gumroad product ID after creating the product
const GUMROAD_PRODUCT_ID = 'YOUR_PRODUCT_ID_HERE';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

function getUserDataPath(): string {
    return app.getPath('userData');
}

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'good.DJ',
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        icon: path.join(__dirname, '../assets/icon.png'),
        show: false, // Don't show until ready
        backgroundColor: '#0f0f0f',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        }
    });

    if (!app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Smooth reveal once content is ready
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function startBackend(): void {
    const userDataPath = getUserDataPath();
    console.log(`[Electron] Starting backend, USER_DATA_PATH=${userDataPath}`);

    if (!app.isPackaged) {
        serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, USER_DATA_PATH: userDataPath },
            stdio: 'inherit',
            shell: true
        });
    } else {
        serverProcess = spawn(process.execPath, [path.join(__dirname, '../server-dist/index.js')], {
            env: {
                ...process.env,
                USER_DATA_PATH: userDataPath,
                ELECTRON_RUN_AS_NODE: '1'
            },
            stdio: 'inherit',
            shell: false
        });
    }
}

// ── LICENSE IPC HANDLERS ──

function setupLicenseIPC(): void {
    const userDataPath = getUserDataPath();

    ipcMain.handle('license:verify', async (_event, key: string) => {
        const result = await verifyLicense(key, GUMROAD_PRODUCT_ID, userDataPath);
        return result;
    });

    ipcMain.handle('license:status', async () => {
        const cached = getCachedLicense(userDataPath);
        if (!cached) {
            return { activated: false };
        }

        // Check if re-validation is needed
        if (needsRevalidation(cached)) {
            const result = await verifyLicense(cached.key, GUMROAD_PRODUCT_ID, userDataPath);
            if (!result.success) {
                return { activated: false, error: 'License re-validation failed.' };
            }
        }

        return {
            activated: true,
            email: cached.email,
            key: cached.key.slice(0, 8) + '...',
        };
    });

    ipcMain.handle('license:clear', async () => {
        clearLicense(userDataPath);
        return { success: true };
    });

    ipcMain.handle('app:version', () => {
        return app.getVersion();
    });
}

// ── APP LIFECYCLE ──

app.whenReady().then(() => {
    setupLicenseIPC();
    startBackend();
    createWindow();
    if (mainWindow) setupIpcHandlers(mainWindow);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
