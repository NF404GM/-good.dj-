// Web-only configuration — no server backend required
// All audio processing happens client-side via Web Audio API

export const SHOW_ARCHITECTURE_VIEW = import.meta.env.DEV === true;

// Legacy API_BASE and SERVER_BASE kept as stubs for any remaining references
// These will be removed in a future cleanup pass
export const API_BASE = '';
export const SERVER_BASE = '';
