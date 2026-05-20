# caller-agent

Conference demo agent for GigaCaller.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

Set `GIGACALLER_GATEWAY_WS_URL` to a running `gigacaller-gateway` WebSocket base URL.

GigaChat credentials are optional. Without them, the app uses local fallback result cards.
