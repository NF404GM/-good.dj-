import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { getCachedLicense, verifyLicense, clearLicense, needsRevalidation } from './license.ts';
import { setupIpcHandlers } from './ipcHandlers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeLoadEnvFile(filename: string) {
    try {
        process.loadEnvFile(filename);
    } catch {
        // Local env files are optional in development.
    }
}

safeLoadEnvFile('.env.local');
safeLoadEnvFile('.env');

// GUMROAD_PRODUCT_ID is read from .env (VITE_GUMROAD_PRODUCT_ID).
// The .env file is NOT committed to git. Set it locally from your Gumroad
// Dashboard -> Products -> [good.dj] -> Permalink before distributing.
const GUMROAD_PRODUCT_ID = process.env.VITE_GUMROAD_PRODUCT_ID ?? '';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
let cleanupIpcHandlers: (() => void) | null = null;

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'gooddj-file',
        privileges: {
            secure: true,
            standard: true,
            stream: true,
            corsEnabled: true,
        },
    },
]);

function getUserDataPath(): string {
    return app.getPath('userData');
}

/**
 * Silently checks GitHub Releases for a newer version.
 * 2-second timeout. Never throws. Fires after window loads.
 */
async function checkForUpdates(window: BrowserWindow): Promise<void> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(
            'https://api.github.com/repos/NF404GM/-good.dj-/releases/latest',
            {
                signal: controller.signal,
                headers: { 'User-Agent': 'good.dj-app' },
            }
        );
        clearTimeout(timeoutId);

        if (!res.ok) {
            return;
        }

        const data = await res.json() as { tag_name?: string };
        const latestTag = data.tag_name?.replace(/^v/, '');
        const currentVer = app.getVersion();

        if (latestTag && latestTag !== currentVer) {
            window.webContents.send('update-available', {
                current: currentVer,
                latest: latestTag,
                url: `https://github.com/NF404GM/-good.dj-/releases/tag/v${latestTag}`,
            });
        }
    } catch {
        // Offline or timeout - never surface errors to the user.
    }
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
        show: false,
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

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.webContents.on('did-finish-load', () => {
        if (mainWindow) {
            void checkForUpdates(mainWindow);
        }
    });

    cleanupIpcHandlers?.();
    cleanupIpcHandlers = setupIpcHandlers(mainWindow);

    mainWindow.on('closed', () => {
        cleanupIpcHandlers?.();
        cleanupIpcHandlers = null;
        mainWindow = null;
    });
}

async function startBackend(): Promise<void> {
    const userDataPath = getUserDataPath();
    console.log(`[Electron] Starting backend, USER_DATA_PATH=${userDataPath}`);

    if (!app.isPackaged) {
        serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, USER_DATA_PATH: userDataPath },
            stdio: 'inherit',
            shell: true
        });
        return;
    }

    process.env.USER_DATA_PATH = userDataPath;
    const { startServer } = await import('../server-dist/index.js');
    await startServer();
}

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

app.whenReady().then(async () => {
    protocol.registerFileProtocol('gooddj-file', (request, callback) => {
        try {
            const encodedPath = request.url.replace('gooddj-file://', '');
            const filePath = decodeURIComponent(encodedPath);
            callback({ path: filePath });
        } catch (err) {
            console.error('[Protocol] gooddj-file error:', err);
            callback({ error: -2 });
        }
    });

    setupLicenseIPC();
    await startBackend();
    createWindow();

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
    cleanupIpcHandlers?.();
    cleanupIpcHandlers = null;

    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
});
