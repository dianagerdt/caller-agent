# GigaCaller Agent

Conference demo agent for GigaCaller: a bright comic-terminal web UI, a Node.js
backend, GigaCaller Gateway WebSocket integration, live transcript streaming, and
post-call result cards.

## Local Setup

Requirements:

- Node.js 20+
- running `gigacaller-gateway`
- optional GigaChat auth data for LLM-generated result cards

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

GigaChat auth data is optional. Without it, the app uses local fallback result cards.

## Configuration

- `PORT`: local HTTP port, defaults to `3000`.
- `GIGACALLER_GATEWAY_WS_URL`: base WebSocket URL for GigaCaller Gateway. Use the host/base URL, for example `wss://gateway.example.ru`; `/v1/ws` is appended by the app if it is not already present.
- `GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED`: set to `false` only for local demos against a gateway certificate that is not trusted by your Node.js installation. Prefer installing the corporate CA and leaving this `true`.
- `DEFAULT_RETRY`: retry string sent to gateway, defaults to `0`.
- `DEFAULT_VOICE`: default freespeech voice.
- `GIGACHAT_ACCESS_TOKEN`: optional ready-to-use Bearer token. If set, OAuth is skipped.
- `GIGACHAT_CREDENTIALS`: optional pre-encoded Basic authorization key for GigaChat OAuth, without the `Basic ` prefix.
- `GIGACHAT_USERNAME`: optional OAuth login/client id. Used with `GIGACHAT_PASSWORD` when `GIGACHAT_CREDENTIALS` is empty.
- `GIGACHAT_PASSWORD`: optional OAuth password/client secret. Used with `GIGACHAT_USERNAME`.
- `GIGACHAT_SCOPE`: optional OAuth scope. Leave blank if your GigaChat access does not require it.
- `GIGACHAT_AUTH_URL`: GigaChat OAuth URL.
- `GIGACHAT_API_BASE_URL`: GigaChat REST API base URL.
- `GIGACHAT_MODEL`: chat completion model, defaults to `GigaChat`.

GigaChat auth priority:

1. `GIGACHAT_ACCESS_TOKEN`
2. `GIGACHAT_CREDENTIALS`
3. `GIGACHAT_USERNAME` + `GIGACHAT_PASSWORD`

## Demo Flow

1. Open the dashboard.
2. Enter a consenting participant phone number.
3. Pick a quest or write a custom prompt in the free-prompt tab.
4. Pick a freespeech voice.
5. Click `Позвонить`.
6. Watch live transcript events in the comic terminal.
7. Wait for the result card after the call reaches a terminal status.

## Quests

- `Айтишный Архетип`: playful conference personality quiz.
- `Исповедь Отладчика`: short debugging confession format.
- `Мини-RPG: Прод Упал`: interactive incident-response mini-game.
- `Свободный Промпт`: participant-defined scenario wrapped by the agent guardrails.

Only freespeech gateway voices are exposed in the UI. Binary audio chunks from
GigaCaller are ignored by the backend and are not sent to the browser.

## Production Build

```bash
npm run build
npm start
```

`npm run build` compiles the server entrypoint to `dist/server/index.js` and builds the client bundle to `dist/client`. `npm start` runs the emitted server artifact.

## Limitations

- No persistent database; sessions live in memory.
- Binary audio is ignored.
- The app does not modify GigaCaller services.
- Custom `agentFunctions` cannot be passed through the current gateway contract.
- Result cards fall back to local deterministic cards when GigaChat credentials are missing or the API call fails.
