
# Balance Variance Review — Mock App

A Vite + React + TypeScript UI with Tailwind for Finance to review balance variance breaks and drill down to transactions.
Includes a tiny mock API (Express). If the API isn't running, the UI gracefully falls back to local mock data.

## Quick Start
```bash
# 1) Unzip
cd balance-variance-review

# 2) Install deps
npm install

# 3) (Optional) start the mock API in a separate terminal
npm run api
# serves GET /api/variances and GET /api/transactions/:varianceId on http://localhost:4000

# 4) Start the UI
npm run dev
# open the URL printed by Vite (usually http://localhost:5173)
```

The Vite dev server proxies `/api/*` to the mock API. If API is not running, the app uses local mock data defined in `src/mockData.ts`.

## Build
```bash
npm run build
npm run preview
```

## Files of Interest
- `src/App.tsx` — Main UI
- `src/dataService.ts` — Fetches from `/api/*`, with fallback
- `src/mockData.ts` — Mock data shared by UI and API
- `mock-api/server.js` — Express server for mock endpoints
- `vite.config.ts` — Proxy config for `/api`
