# Portfolio Manager

Local‑first portfolio tracking with a clean, black‑and‑white UI.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

## What’s inside
- Dashboard (`/dashboard`): portfolio stats, chart, transactions list
- Settings (`/settings`): choose the local data folder
- Global header: Settings button in the top‑right corner

## Data model
- Your data is stored locally as JSON in the folder you pick in Settings
- Current file: `transactions.json`

## Build & run
```bash
npm run build
npm start
```

## Tech
- Next.js (App Router), React 19
- Tailwind CSS 4, shadcn/ui, lucide‑react
- recharts, react‑hook‑form, zod, date‑fns, sonner

## Notes
- No server DB; everything is local‑first. You control your data.
