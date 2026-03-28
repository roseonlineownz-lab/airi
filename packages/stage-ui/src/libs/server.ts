// When VITE_SERVER_URL is unset, default to '' (same-origin).
// In production, CF Workers proxies /api/* to the backend.
// In development, Vite dev server proxies /api/* to localhost:3000.
// Set VITE_SERVER_URL explicitly for cross-origin setups (e.g. self-hosted).
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''
