const rawApiBase = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:3003/api';

export const API_BASE = rawApiBase;
export const SERVER_BASE = rawApiBase.endsWith('/api') ? rawApiBase.slice(0, -4) : rawApiBase;
export const SHOW_ARCHITECTURE_VIEW = import.meta.env.DEV === true;
