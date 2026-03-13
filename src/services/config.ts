const vitePort = Number(import.meta.env.VITE_SERVER_PORT ?? Number.NaN);
const processPort = typeof process !== 'undefined' ? Number(process.env.VITE_SERVER_PORT ?? Number.NaN) : Number.NaN;
const SERVER_PORT = Number.isFinite(vitePort) && vitePort > 0
    ? vitePort
    : Number.isFinite(processPort) && processPort > 0
        ? processPort
        : 3003;

export const SERVER_BASE = `http://127.0.0.1:${SERVER_PORT}`;
export const API_BASE = `${SERVER_BASE}/api`;
export const SHOW_ARCHITECTURE_VIEW = import.meta.env.DEV === true;
