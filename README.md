# caller-agent

Conference demo agent for GigaCaller.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

`npm run dev` starts the demo server process with `tsx watch src/server/index.ts`. The server is the default local entrypoint for the combined client/server app and is expected to serve the built client assets and API routes.

For frontend-only Vite work, run the optional client dev server separately:

```bash
npm run dev:client
```

The Vite dev server proxies `/api` to `http://localhost:3000`, so keep `npm run dev` running when using it.

Set `GIGACALLER_GATEWAY_WS_URL` to a running `gigacaller-gateway` WebSocket base URL.

GigaChat credentials are optional. Without them, the app uses local fallback result cards.

## Production Build

```bash
npm run build
npm start
```

`npm run build` compiles the server entrypoint to `dist/server/index.js` and builds the client bundle to `dist/client`. `npm start` runs the emitted server artifact.
