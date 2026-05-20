# GigaCaller Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-process Node.js/TypeScript/React demo agent that starts GigaCaller phone quests, streams live transcript, and generates result cards.

**Architecture:** The browser uses REST for commands and SSE for live updates. The Node backend owns sessions, connects to `gigacaller-gateway` over WebSocket, builds Russian prompts, ignores binary audio, and calls GigaChat for post-call cards with local fallback. The React UI is a one-screen "Комикс-терминал" dashboard served by the same process.

**Tech Stack:** Node.js 20+, TypeScript, Fastify, Vite, React, Vitest, `ws`, `zod`, `dotenv`.

---

## File Map

- Create `package.json`: scripts, runtime dependencies, test dependencies.
- Create `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`: TypeScript, client build, test config.
- Create `.env.example`: safe sample configuration.
- Modify `README.md`: local setup and usage.
- Create `src/shared/types.ts`: shared domain types for calls, quests, gateway events, result cards.
- Create `src/server/config.ts`: environment parsing and defaults.
- Create `src/server/prompts/quests.ts`: built-in quest metadata and voice allowlist.
- Create `src/server/prompts/promptBuilder.ts`: system prompt builder and custom prompt wrapper.
- Create `src/server/result-cards/fallback.ts`: deterministic fallback cards.
- Create `src/server/result-cards/schemas.ts`: per-quest card normalization.
- Create `src/server/gigachat/client.ts`: GigaChat OAuth and chat completion client.
- Create `src/server/gigacaller/gatewayClient.ts`: WebSocket adapter to GigaCaller Gateway.
- Create `src/server/sessions/sessionStore.ts`: in-memory session store and event fanout.
- Create `src/server/routes/quests.ts`: `GET /api/quests`.
- Create `src/server/routes/calls.ts`: `POST /api/calls`, `GET /api/calls/:id`, `GET /api/calls/:id/events`, `POST /api/calls/:id/interrupt`.
- Create `src/server/app.ts`: Fastify app wiring.
- Create `src/server/index.ts`: process entrypoint.
- Create `src/client/main.tsx`, `src/client/App.tsx`, `src/client/styles.css`: dashboard UI.
- Create tests under `tests/server/**`.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write scaffold files**

Create `package.json`:

```json
{
  "name": "gigacaller-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "build": "tsc --noEmit && vite build",
    "start": "node dist/server/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@fastify/static": "^8.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "dotenv": "^16.4.7",
    "fastify": "^5.2.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "uuid": "^11.0.5",
    "ws": "^8.18.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@types/ws": "^8.5.13",
    "jsdom": "^25.0.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.6",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/client',
  plugins: [react()],
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
});
```

Create `.env.example`:

```env
PORT=3000
GIGACALLER_GATEWAY_WS_URL=ws://localhost:8080
DEFAULT_RETRY=0
DEFAULT_VOICE=Bik-Freespeech_8000

GIGACHAT_CREDENTIALS=
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_AUTH_URL=https://ngw.devices.sberbank.ru:9443/api/v2/oauth
GIGACHAT_API_BASE_URL=https://gigachat.devices.sberbank.ru/api/v1
GIGACHAT_MODEL=GigaChat
```

Replace `README.md` with:

```md
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
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and install exits with code 0.

- [ ] **Step 3: Run initial checks**

Run: `npm test`

Expected: exits with code 1 or "No test files found" until tests are added. Do not treat missing tests as implementation failure at this step.

- [ ] **Step 4: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts .env.example README.md
git commit -m "chore: scaffold TypeScript React app"
```

## Task 2: Shared Types And Config

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/server/config.ts`
- Test: `tests/server/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `tests/server/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/server/config';

describe('loadConfig', () => {
  it('uses safe defaults for optional settings', () => {
    const config = loadConfig({
      GIGACALLER_GATEWAY_WS_URL: 'ws://gateway:8080'
    });

    expect(config.port).toBe(3000);
    expect(config.gigacallerGatewayWsUrl).toBe('ws://gateway:8080');
    expect(config.defaultRetry).toBe('0');
    expect(config.defaultVoice).toBe('Bik-Freespeech_8000');
    expect(config.gigachat.scope).toBe('GIGACHAT_API_PERS');
  });

  it('rejects missing gateway URL', () => {
    expect(() => loadConfig({})).toThrow('GIGACALLER_GATEWAY_WS_URL is required');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/server/config.test.ts`

Expected: FAIL because `src/server/config.ts` does not exist.

- [ ] **Step 3: Implement shared types**

Create `src/shared/types.ts`:

```ts
export type QuestId = 'it-archetype' | 'debugging-confession' | 'prod-down-rpg' | 'custom';

export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'published'
  | 'ringing'
  | 'answered'
  | 'completed'
  | 'noAnswer'
  | 'failed'
  | 'closed'
  | 'interrupted';

export type TranscriptSource = 'user' | 'model' | 'unknown';

export interface TranscriptItem {
  id: string;
  source: TranscriptSource;
  text: string;
  timestamp: number;
  seqNum?: number;
}

export interface TechnicalEvent {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
  details?: unknown;
}

export interface QuestDefinition {
  id: QuestId;
  title: string;
  description: string;
  accentColor: string;
}

export interface ResultCard {
  questId: QuestId;
  source: 'gigachat' | 'fallback';
  title: string;
  fields: Record<string, string | string[] | number>;
}

export interface CallSessionSnapshot {
  sessionId: string;
  requestId?: string;
  callId?: string;
  questId: QuestId;
  voice: string;
  status: CallStatus;
  transcript: TranscriptItem[];
  technicalEvents: TechnicalEvent[];
  resultCard?: ResultCard;
  createdAt: number;
  updatedAt: number;
}

export type ServerEvent =
  | { type: 'status'; session: CallSessionSnapshot }
  | { type: 'transcription'; item: TranscriptItem }
  | { type: 'technicalEvent'; event: TechnicalEvent }
  | { type: 'functionCall'; data: unknown }
  | { type: 'resultCard'; card: ResultCard }
  | { type: 'error'; message: string; details?: unknown };
```

- [ ] **Step 4: Implement config**

Create `src/server/config.ts`:

```ts
import 'dotenv/config';

export interface AppConfig {
  port: number;
  gigacallerGatewayWsUrl: string;
  defaultRetry: string;
  defaultVoice: string;
  gigachat: {
    credentials?: string;
    scope: string;
    authUrl: string;
    apiBaseUrl: string;
    model: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const gatewayUrl = env.GIGACALLER_GATEWAY_WS_URL?.trim();
  if (!gatewayUrl) {
    throw new Error('GIGACALLER_GATEWAY_WS_URL is required');
  }

  return {
    port: Number(env.PORT ?? 3000),
    gigacallerGatewayWsUrl: gatewayUrl.replace(/\/$/, ''),
    defaultRetry: env.DEFAULT_RETRY ?? '0',
    defaultVoice: env.DEFAULT_VOICE ?? 'Bik-Freespeech_8000',
    gigachat: {
      credentials: env.GIGACHAT_CREDENTIALS?.trim() || undefined,
      scope: env.GIGACHAT_SCOPE ?? 'GIGACHAT_API_PERS',
      authUrl: env.GIGACHAT_AUTH_URL ?? 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      apiBaseUrl: env.GIGACHAT_API_BASE_URL ?? 'https://gigachat.devices.sberbank.ru/api/v1',
      model: env.GIGACHAT_MODEL ?? 'GigaChat'
    }
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/server/config.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/server/config.ts tests/server/config.test.ts
git commit -m "feat: add shared types and config"
```

## Task 3: Quest Metadata And Prompt Builder

**Files:**
- Create: `src/server/prompts/quests.ts`
- Create: `src/server/prompts/promptBuilder.ts`
- Test: `tests/server/promptBuilder.test.ts`

- [ ] **Step 1: Write failing prompt tests**

Create `tests/server/promptBuilder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, FREESPEECH_VOICES, getQuestDefinitions } from '../../src/server/prompts/promptBuilder';

describe('prompt builder', () => {
  it('returns the freespeech voice allowlist', () => {
    expect(FREESPEECH_VOICES).toEqual([
      'Bik-Freespeech_8000',
      'Che-Freespeech_8000',
      'Erm-Freespeech_8000',
      'She-Freespeech_8000',
      'Ved-Freespeech_8000'
    ]);
  });

  it('builds a detailed archetype prompt', () => {
    const prompt = buildSystemPrompt({ questId: 'it-archetype' });

    expect(prompt).toContain('Айтишный Архетип');
    expect(prompt).toContain('Заклинатель легаси');
    expect(prompt).toContain('end_call');
    expect(prompt).toContain('не запрашивай пароли');
  });

  it('wraps custom prompts with safety rules', () => {
    const prompt = buildSystemPrompt({
      questId: 'custom',
      customPrompt: 'Проведи собеседование на senior YAML engineer'
    });

    expect(prompt).toContain('Пользовательский сценарий');
    expect(prompt).toContain('senior YAML engineer');
    expect(prompt).toContain('не выдавай себя за банк');
    expect(prompt).toContain('end_call');
  });

  it('exposes three built-in quests plus custom mode', () => {
    expect(getQuestDefinitions().map((quest) => quest.id)).toEqual([
      'it-archetype',
      'debugging-confession',
      'prod-down-rpg',
      'custom'
    ]);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/server/promptBuilder.test.ts`

Expected: FAIL because prompt modules do not exist.

- [ ] **Step 3: Implement quest metadata**

Create `src/server/prompts/quests.ts`:

```ts
import type { QuestDefinition } from '../../shared/types';

export const FREESPEECH_VOICES = [
  'Bik-Freespeech_8000',
  'Che-Freespeech_8000',
  'Erm-Freespeech_8000',
  'She-Freespeech_8000',
  'Ved-Freespeech_8000'
] as const;

export type FreespeechVoice = (typeof FREESPEECH_VOICES)[number];

export const QUESTS: QuestDefinition[] = [
  {
    id: 'it-archetype',
    title: 'Айтишный Архетип',
    description: 'Веселое интервью, которое превращает участника в инженерный архетип.',
    accentColor: '#7cf7c7'
  },
  {
    id: 'debugging-confession',
    title: 'Исповедь Отладчика',
    description: 'История странного бага превращается в мини-postmortem.',
    accentColor: '#ffd166'
  },
  {
    id: 'prod-down-rpg',
    title: 'Мини-RPG: Прод Упал',
    description: 'Голосовой incident-квест, где участник спасает production.',
    accentColor: '#ff8bd1'
  },
  {
    id: 'custom',
    title: 'Свободный промпт',
    description: 'Свой безопасный сценарий для демо-звонка.',
    accentColor: '#9bdcff'
  }
];

export function isAllowedVoice(voice: string): voice is FreespeechVoice {
  return FREESPEECH_VOICES.includes(voice as FreespeechVoice);
}
```

- [ ] **Step 4: Implement prompt builder**

Create `src/server/prompts/promptBuilder.ts`:

```ts
import type { QuestId } from '../../shared/types';
import { FREESPEECH_VOICES, QUESTS } from './quests';

interface BuildPromptInput {
  questId: QuestId;
  customPrompt?: string | null;
}

const COMMON_RULES = `Общие правила:
- говори только по-русски;
- представься как демо-агент конференции для айтишников;
- сначала спроси, удобно ли участнику пройти короткий голосовой квест;
- если участник отказывается или просит закончить, вежливо заверши звонок;
- не запрашивай пароли, коды, паспортные данные, банковские данные и другие секреты;
- не обещай реальных действий вне демо;
- не выдавай себя за банк, госорган, поддержку, работодателя или реальную компанию;
- говори короткими живыми репликами;
- задавай один основной вопрос за раз;
- если квест завершен, озвучь итог, попрощайся и вызови встроенную функцию end_call.`;

const BUILT_IN_PROMPTS: Record<Exclude<QuestId, 'custom'>, string> = {
  'it-archetype': `Ты - веселый, вежливый и наблюдательный демо-агент конференции для айтишников.
Ты звонишь участнику, чтобы провести квест "Айтишный Архетип".

Твоя задача - за разговор понять, какой у участника шуточный инженерный архетип.
Разговор должен быть легким, живым и дружелюбным. Не превращай его в анкету.

Что нужно выяснить:
- роль участника: backend, frontend, mobile, data, DevOps, QA, architect, manager или другое;
- основной стек или любимые технологии;
- какая техническая боль знакома лучше всего;
- как участник обычно чинит сложные проблемы;
- что его больше раздражает: легаси, flaky-тесты, продовые инциденты, пиксельные правки, YAML, созвоны, неопределенные требования или что-то другое;
- какой суперсилой он бы хотел обладать в разработке.

Финал:
Озвучь название архетипа, короткое описание, сильную сторону, опасную зону и шуточный бейдж.

Примеры архетипов:
- "Заклинатель легаси";
- "Пиксельный перфекционист";
- "Терапевт распределенных систем";
- "Хранитель продового костыля";
- "Повелитель flaky-тестов";
- "YAML-археолог";
- "Инцидент-командир пятничного релиза".`,

  'debugging-confession': `Ты - дружелюбный демо-агент конференции для айтишников.
Ты проводишь квест "Исповедь Отладчика".

Твоя задача - помочь участнику рассказать историю самого странного, болезненного или смешного бага, а затем собрать из нее короткий postmortem.
Тон - теплый, любопытный, немного мемный, но без токсичности.

Что нужно выяснить:
- что сломалось или выглядело сломанным;
- какие были симптомы;
- как долго искали причину;
- в чем оказался root cause;
- был ли impact: пользователи, деньги, SLA, команда, репутация, сон;
- как починили;
- какой урок остался;
- какое мемное название подошло бы этому инциденту.

Финал:
Собери мини-postmortem: название инцидента, краткое описание, root cause, impact, fix, lesson learned и мемный caption.`,

  'prod-down-rpg': `Ты - демо-агент конференции и ведущий голосовой мини-RPG "Прод Упал".
Участник играет дежурного инженера. Ты ведешь сцену, принимаешь решения участника и адаптируешь сюжет.

Тон - энергичный, игровой, айтишный. Говори короткими сценами.
Не делай длинных монологов. Участник должен часто выбирать действие голосом.

Стартовая сцена:
Прод горит. Метрики красные. В чатике пишут "у кого-нибудь тоже 500?".
У участника есть несколько возможных действий, но он может предложить свое:
- посмотреть логи;
- откатить релиз;
- проверить базу;
- написать в инцидентный канал;
- сделать вид, что это фича;
- любое свободное действие.

Финал:
Озвучь, чем закончился инцидент, какие решения принял участник, насколько выжил прод, шуточный verdict и бейдж участника.`
};

export { FREESPEECH_VOICES };

export function getQuestDefinitions() {
  return QUESTS;
}

export function buildSystemPrompt(input: BuildPromptInput): string {
  if (input.questId === 'custom') {
    const customPrompt = input.customPrompt?.trim() || 'Проведи безопасный короткий демо-разговор с участником конференции.';
    return `${COMMON_RULES}

Ты - демо-агент конференции для айтишников.
Ты звонишь только участнику, который ввел этот номер или согласился на звонок.
Всегда честно говори, что ты демо-агент конференции.

Пользовательский сценарий:
${customPrompt}

Правила безопасности:
- не выдавай себя за банк, госорган, службу поддержки, работодателя, полицию, врача или реальную компанию;
- не проси пароли, одноразовые коды, паспортные данные, банковские данные и другие секреты;
- не помогай с обманом, давлением, социальной инженерией, угрозами или преследованием;
- если пользовательский сценарий небезопасен, вежливо откажись выполнять опасную часть и предложи безопасный демо-вариант;
- когда сценарий завершен, попрощайся и вызови end_call.`;
  }

  return `${COMMON_RULES}

${BUILT_IN_PROMPTS[input.questId]}

После финала скажи короткую фразу прощания и вызови end_call.`;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/server/promptBuilder.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/prompts tests/server/promptBuilder.test.ts
git commit -m "feat: add quest prompt builder"
```

## Task 4: Session Store And Fallback Cards

**Files:**
- Create: `src/server/sessions/sessionStore.ts`
- Create: `src/server/result-cards/fallback.ts`
- Test: `tests/server/sessionStore.test.ts`
- Test: `tests/server/fallbackCards.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/server/sessionStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SessionStore } from '../../src/server/sessions/sessionStore';

describe('SessionStore', () => {
  it('creates and updates sessions', () => {
    const store = new SessionStore();
    const session = store.create({ questId: 'it-archetype', voice: 'Bik-Freespeech_8000' });

    store.setRequestId(session.sessionId, 'req-1');
    store.setStatus(session.sessionId, 'answered');
    store.addTranscript(session.sessionId, { source: 'user', text: 'Привет', seqNum: 1 });

    const snapshot = store.get(session.sessionId);
    expect(snapshot?.requestId).toBe('req-1');
    expect(snapshot?.status).toBe('answered');
    expect(snapshot?.transcript[0]?.text).toBe('Привет');
  });
});
```

Create `tests/server/fallbackCards.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildFallbackCard } from '../../src/server/result-cards/fallback';

describe('buildFallbackCard', () => {
  it('builds an archetype fallback card', () => {
    const card = buildFallbackCard('it-archetype', [
      { id: '1', source: 'user', text: 'Я backend-разработчик, люблю чинить легаси', timestamp: 1 }
    ]);

    expect(card.source).toBe('fallback');
    expect(card.title).toContain('Айтишный Архетип');
    expect(card.fields.archetype).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/server/sessionStore.test.ts tests/server/fallbackCards.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement session store**

Create `src/server/sessions/sessionStore.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { CallSessionSnapshot, CallStatus, QuestId, ResultCard, ServerEvent, TechnicalEvent, TranscriptItem, TranscriptSource } from '../../shared/types';

interface CreateSessionInput {
  questId: QuestId;
  voice: string;
}

type Listener = (event: ServerEvent) => void;

export class SessionStore {
  private sessions = new Map<string, CallSessionSnapshot>();
  private listeners = new Map<string, Set<Listener>>();

  create(input: CreateSessionInput): CallSessionSnapshot {
    const now = Date.now();
    const session: CallSessionSnapshot = {
      sessionId: randomUUID(),
      questId: input.questId,
      voice: input.voice,
      status: 'connecting',
      transcript: [],
      technicalEvents: [],
      createdAt: now,
      updatedAt: now
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  get(sessionId: string): CallSessionSnapshot | undefined {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : undefined;
  }

  setRequestId(sessionId: string, requestId: string): void {
    this.update(sessionId, (session) => {
      session.requestId = requestId;
    });
  }

  setCallId(sessionId: string, callId: string): void {
    this.update(sessionId, (session) => {
      session.callId = callId;
    });
  }

  setStatus(sessionId: string, status: CallStatus): void {
    const session = this.update(sessionId, (current) => {
      current.status = status;
    });
    if (session) {
      this.emit(sessionId, { type: 'status', session });
    }
  }

  addTranscript(sessionId: string, input: { source: TranscriptSource; text: string; seqNum?: number }): TranscriptItem {
    const item: TranscriptItem = {
      id: randomUUID(),
      source: input.source,
      text: input.text,
      seqNum: input.seqNum,
      timestamp: Date.now()
    };
    this.update(sessionId, (session) => {
      session.transcript.push(item);
    });
    this.emit(sessionId, { type: 'transcription', item });
    return item;
  }

  addTechnicalEvent(sessionId: string, input: Omit<TechnicalEvent, 'id' | 'timestamp'>): TechnicalEvent {
    const event: TechnicalEvent = {
      id: randomUUID(),
      timestamp: Date.now(),
      ...input
    };
    this.update(sessionId, (session) => {
      session.technicalEvents.push(event);
    });
    this.emit(sessionId, { type: 'technicalEvent', event });
    return event;
  }

  setResultCard(sessionId: string, card: ResultCard): void {
    this.update(sessionId, (session) => {
      session.resultCard = card;
    });
    this.emit(sessionId, { type: 'resultCard', card });
  }

  subscribe(sessionId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(sessionId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(sessionId, listeners);
    return () => listeners.delete(listener);
  }

  private update(sessionId: string, mutate: (session: CallSessionSnapshot) => void): CallSessionSnapshot | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    mutate(session);
    session.updatedAt = Date.now();
    return structuredClone(session);
  }

  private emit(sessionId: string, event: ServerEvent): void {
    for (const listener of this.listeners.get(sessionId) ?? []) {
      listener(event);
    }
  }
}
```

- [ ] **Step 4: Implement fallback cards**

Create `src/server/result-cards/fallback.ts`:

```ts
import type { QuestId, ResultCard, TranscriptItem } from '../../shared/types';

function transcriptSummary(transcript: TranscriptItem[]): string {
  const text = transcript.map((item) => item.text).join(' ').trim();
  return text.length > 240 ? `${text.slice(0, 237)}...` : text || 'Разговор не содержит распознанных реплик.';
}

export function buildFallbackCard(questId: QuestId, transcript: TranscriptItem[]): ResultCard {
  const summary = transcriptSummary(transcript);

  if (questId === 'it-archetype') {
    return {
      questId,
      source: 'fallback',
      title: 'Айтишный Архетип',
      fields: {
        archetype: 'Хранитель продового костыля',
        description: summary,
        strengths: ['Выживает в неопределенности', 'Находит рабочие обходы'],
        dangerZone: 'Может чинить слишком быстро и забыть записать, как именно.',
        badgeText: 'LEGACY FRIENDLY',
        funnyAdvice: 'Пей воду, пиши runbook, не деплой в пятницу.'
      }
    };
  }

  if (questId === 'debugging-confession') {
    return {
      questId,
      source: 'fallback',
      title: 'Исповедь Отладчика',
      fields: {
        incidentName: 'Инцидент с неопознанным null',
        summary,
        rootCause: 'Недостаточно данных для точного root cause.',
        impact: 'Оценить по transcript не удалось.',
        fix: 'Вероятно, помогли внимательность и терпение.',
        lessonLearned: 'Любой странный баг заслуживает хорошего postmortem.',
        memeCaption: 'Работало вчера, значит виноват сегодняшний день.'
      }
    };
  }

  if (questId === 'prod-down-rpg') {
    return {
      questId,
      source: 'fallback',
      title: 'Мини-RPG: Прод Упал',
      fields: {
        ending: summary,
        decisions: ['Собраны из transcript частично'],
        productionSurvivalLevel: 73,
        verdict: 'Прод выжил, но попросил отпуск.',
        badgeText: 'ON-CALL SURVIVOR'
      }
    };
  }

  return {
    questId,
    source: 'fallback',
    title: 'Свободный Промпт',
    fields: {
      summary,
      highlights: ['Fallback-карточка без GigaChat'],
      outcome: 'Сценарий завершен или остановлен.',
      badgeText: 'DEMO PLAYER'
    }
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/server/sessionStore.test.ts tests/server/fallbackCards.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/sessions src/server/result-cards tests/server/sessionStore.test.ts tests/server/fallbackCards.test.ts
git commit -m "feat: add session store and fallback cards"
```

## Task 5: GigaCaller Gateway Adapter

**Files:**
- Create: `src/server/gigacaller/gatewayClient.ts`
- Test: `tests/server/gatewayClient.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `tests/server/gatewayClient.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeGatewayTextMessage } from '../../src/server/gigacaller/gatewayClient';

describe('normalizeGatewayTextMessage', () => {
  it('normalizes ready messages', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'ready',
      data: { requestId: 'req-1' }
    }))).toEqual({ type: 'ready', requestId: 'req-1' });
  });

  it('normalizes transcription source and text', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'transcription',
      data: { source: 'USER', text: 'Привет', seqNum: 2 }
    }))).toEqual({ type: 'transcription', source: 'user', text: 'Привет', seqNum: 2, callId: undefined });
  });

  it('throws on invalid JSON', () => {
    expect(() => normalizeGatewayTextMessage('{bad')).toThrow('Invalid gateway JSON');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/server/gatewayClient.test.ts`

Expected: FAIL because gateway client does not exist.

- [ ] **Step 3: Implement gateway adapter**

Create `src/server/gigacaller/gatewayClient.ts`:

```ts
import WebSocket from 'ws';
import type { TranscriptSource } from '../../shared/types';

export type NormalizedGatewayMessage =
  | { type: 'ready'; requestId: string }
  | { type: 'status'; status: string; requestId?: string; callId?: string; data: unknown }
  | { type: 'transcription'; source: TranscriptSource; text: string; seqNum?: number; callId?: string }
  | { type: 'functionCall'; data: unknown }
  | { type: 'error'; message: string; data?: unknown }
  | { type: 'unknown'; rawType?: string; data?: unknown };

export interface GatewayClientOptions {
  baseUrl: string;
  requestId?: string;
  onMessage: (message: NormalizedGatewayMessage) => void;
  onBinary: (bytes: Buffer) => void;
  onClose: () => void;
  onError: (error: Error) => void;
}

export class GatewayClient {
  private ws?: WebSocket;

  constructor(private readonly options: GatewayClientOptions) {}

  connect(): void {
    const url = `${this.options.baseUrl.replace(/\/$/, '')}/v1/ws/${this.options.requestId ?? ''}`;
    this.ws = new WebSocket(url);
    this.ws.on('message', (data, isBinary) => {
      if (isBinary) {
        this.options.onBinary(Buffer.from(data as Buffer));
        return;
      }
      try {
        this.options.onMessage(normalizeGatewayTextMessage(data.toString()));
      } catch (error) {
        this.options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    });
    this.ws.on('close', () => this.options.onClose());
    this.ws.on('error', (error) => this.options.onError(error));
  }

  sendInitialRequest(input: { phoneNumber: string; systemPrompt: string; retry: string; voice: string }): void {
    this.sendJson({ type: 'initialRequest', data: input });
  }

  interrupt(calledAt = Date.now()): void {
    this.sendJson({ type: 'interrupt', data: { calledAt } });
  }

  close(): void {
    this.ws?.close();
  }

  private sendJson(payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway WebSocket is not open');
    }
    this.ws.send(JSON.stringify(payload));
  }
}

export function normalizeGatewayTextMessage(raw: string): NormalizedGatewayMessage {
  let parsed: { type?: string; data?: any };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid gateway JSON');
  }

  const data = parsed.data ?? {};

  if (parsed.type === 'ready') {
    return { type: 'ready', requestId: String(data.requestId) };
  }

  if (parsed.type === 'status') {
    return {
      type: 'status',
      status: String(data.status),
      requestId: data.requestId,
      callId: data.callId || undefined,
      data
    };
  }

  if (parsed.type === 'transcription') {
    return {
      type: 'transcription',
      source: normalizeSource(data.source),
      text: String(data.text ?? ''),
      seqNum: typeof data.seqNum === 'number' ? data.seqNum : undefined,
      callId: data.callId || undefined
    };
  }

  if (parsed.type === 'functionCall') {
    return { type: 'functionCall', data };
  }

  if (parsed.type === 'error') {
    return { type: 'error', message: String(data.message ?? 'Gateway error'), data };
  }

  return { type: 'unknown', rawType: parsed.type, data };
}

function normalizeSource(source: unknown): TranscriptSource {
  const value = String(source ?? '').toLowerCase();
  if (value === 'user' || value === '2') return 'user';
  if (value === 'model' || value === '1') return 'model';
  return 'unknown';
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/server/gatewayClient.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/gigacaller tests/server/gatewayClient.test.ts
git commit -m "feat: add GigaCaller gateway adapter"
```

## Task 6: REST Routes And SSE

**Files:**
- Create: `src/server/routes/quests.ts`
- Create: `src/server/routes/calls.ts`
- Create: `src/server/app.ts`
- Create: `src/server/index.ts`
- Test: `tests/server/routes.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `tests/server/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { loadConfig } from '../../src/server/config';

const config = loadConfig({ GIGACALLER_GATEWAY_WS_URL: 'ws://localhost:9999' });

describe('routes', () => {
  it('returns quests and voices', async () => {
    const app = buildApp({ config });
    const response = await app.inject({ method: 'GET', url: '/api/quests' });
    expect(response.statusCode).toBe(200);
    expect(response.json().voices).toContain('Bik-Freespeech_8000');
  });

  it('rejects invalid voice on start call', async () => {
    const app = buildApp({ config });
    const response = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '+79990000000',
        questId: 'it-archetype',
        voice: 'Krn_8000'
      }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('Unsupported voice');
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/server/routes.test.ts`

Expected: FAIL because app/routes do not exist.

- [ ] **Step 3: Implement quests route**

Create `src/server/routes/quests.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { FREESPEECH_VOICES, getQuestDefinitions } from '../prompts/promptBuilder';

export async function registerQuestRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/quests', async () => ({
    quests: getQuestDefinitions(),
    voices: FREESPEECH_VOICES
  }));
}
```

- [ ] **Step 4: Implement call routes**

Create `src/server/routes/calls.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config';
import { GatewayClient } from '../gigacaller/gatewayClient';
import { buildSystemPrompt } from '../prompts/promptBuilder';
import { isAllowedVoice } from '../prompts/quests';
import { buildFallbackCard } from '../result-cards/fallback';
import { SessionStore } from '../sessions/sessionStore';

const startCallSchema = z.object({
  phoneNumber: z.string().min(5),
  questId: z.enum(['it-archetype', 'debugging-confession', 'prod-down-rpg', 'custom']),
  voice: z.string(),
  customPrompt: z.string().optional().nullable()
});

export async function registerCallRoutes(app: FastifyInstance, deps: { config: AppConfig; sessions: SessionStore }): Promise<void> {
  const gateways = new Map<string, GatewayClient>();

  app.post('/api/calls', async (request, reply) => {
    const parsed = startCallSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid call request', issues: parsed.error.issues });
    }

    if (!isAllowedVoice(parsed.data.voice)) {
      return reply.code(400).send({ message: `Unsupported voice: ${parsed.data.voice}` });
    }

    const phoneNumber = cleanPhoneNumber(parsed.data.phoneNumber);
    if (!isValidPhoneNumber(phoneNumber)) {
      return reply.code(400).send({ message: 'Invalid phone number' });
    }

    const session = deps.sessions.create({ questId: parsed.data.questId, voice: parsed.data.voice });
    const systemPrompt = buildSystemPrompt(parsed.data);

    const gateway = new GatewayClient({
      baseUrl: deps.config.gigacallerGatewayWsUrl,
      onBinary: () => deps.sessions.addTechnicalEvent(session.sessionId, { level: 'info', message: 'Ignored binary audio chunk' }),
      onClose: () => {
        deps.sessions.addTechnicalEvent(session.sessionId, { level: 'warning', message: 'Gateway WebSocket closed' });
        const snapshot = deps.sessions.get(session.sessionId);
        if (snapshot && !snapshot.resultCard) {
          deps.sessions.setResultCard(session.sessionId, buildFallbackCard(snapshot.questId, snapshot.transcript));
        }
      },
      onError: (error) => deps.sessions.addTechnicalEvent(session.sessionId, { level: 'error', message: error.message }),
      onMessage: (message) => {
        if (message.type === 'ready') {
          deps.sessions.setRequestId(session.sessionId, message.requestId);
          gateway.sendInitialRequest({
            phoneNumber,
            systemPrompt,
            retry: deps.config.defaultRetry,
            voice: parsed.data.voice
          });
          deps.sessions.setStatus(session.sessionId, 'published');
        } else if (message.type === 'status') {
          if (message.callId) deps.sessions.setCallId(session.sessionId, message.callId);
          deps.sessions.setStatus(session.sessionId, normalizeStatus(message.status));
        } else if (message.type === 'transcription') {
          if (message.callId) deps.sessions.setCallId(session.sessionId, message.callId);
          deps.sessions.addTranscript(session.sessionId, { source: message.source, text: message.text, seqNum: message.seqNum });
        } else if (message.type === 'functionCall') {
          deps.sessions.addTechnicalEvent(session.sessionId, { level: 'info', message: 'Function call received', details: message.data });
        } else if (message.type === 'error') {
          deps.sessions.addTechnicalEvent(session.sessionId, { level: 'error', message: message.message, details: message.data });
        }
      }
    });

    gateways.set(session.sessionId, gateway);
    gateway.connect();
    return reply.code(202).send(deps.sessions.get(session.sessionId));
  });

  app.get('/api/calls/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = deps.sessions.get(sessionId);
    if (!session) return reply.code(404).send({ message: 'Session not found' });
    return session;
  });

  app.get('/api/calls/:sessionId/events', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    if (!deps.sessions.get(sessionId)) return reply.code(404).send({ message: 'Session not found' });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    const unsubscribe = deps.sessions.subscribe(sessionId, (event) => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    request.raw.on('close', unsubscribe);
  });

  app.post('/api/calls/:sessionId/interrupt', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const gateway = gateways.get(sessionId);
    if (!gateway) return reply.code(404).send({ message: 'Session not found' });
    gateway.interrupt();
    deps.sessions.setStatus(sessionId, 'interrupted');
    return { ok: true };
  });
}

function cleanPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[^\d+]/g, '').replace(/^\+/, '');
}

function isValidPhoneNumber(phoneNumber: string): boolean {
  return /^\d{10,15}$/.test(phoneNumber);
}

function normalizeStatus(status: string): any {
  if (['ringing', 'answered', 'completed', 'noAnswer', 'failed'].includes(status)) return status;
  return 'published';
}
```

- [ ] **Step 5: Implement app and entrypoint**

Create `src/server/app.ts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { AppConfig } from './config';
import { loadConfig } from './config';
import { registerCallRoutes } from './routes/calls';
import { registerQuestRoutes } from './routes/quests';
import { SessionStore } from './sessions/sessionStore';

interface BuildAppInput {
  config?: AppConfig;
  sessions?: SessionStore;
}

export function buildApp(input: BuildAppInput = {}) {
  const app = Fastify({ logger: true });
  const config = input.config ?? loadConfig();
  const sessions = input.sessions ?? new SessionStore();
  const dirname = path.dirname(fileURLToPath(import.meta.url));

  app.register(registerQuestRoutes);
  app.register(registerCallRoutes, { config, sessions });

  app.register(fastifyStatic, {
    root: path.resolve(dirname, '../../client'),
    prefix: '/'
  });

  return app;
}
```

Create `src/server/index.ts`:

```ts
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = buildApp({ config });

await app.listen({ port: config.port, host: '0.0.0.0' });
```

- [ ] **Step 6: Run route tests**

Run: `npm test -- tests/server/routes.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/routes src/server/app.ts src/server/index.ts tests/server/routes.test.ts
git commit -m "feat: add REST and SSE routes"
```

## Task 7: GigaChat Client And Result Generation

**Files:**
- Create: `src/server/gigachat/client.ts`
- Create: `src/server/result-cards/generator.ts`
- Test: `tests/server/resultGenerator.test.ts`

- [ ] **Step 1: Write failing result generator tests**

Create `tests/server/resultGenerator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { generateResultCard } from '../../src/server/result-cards/generator';

describe('generateResultCard', () => {
  it('uses fallback when credentials are absent', async () => {
    const card = await generateResultCard({
      questId: 'custom',
      transcript: [{ id: '1', source: 'user', text: 'Привет', timestamp: 1 }],
      gigachat: { scope: 'GIGACHAT_API_PERS', authUrl: '', apiBaseUrl: '', model: 'GigaChat' }
    });

    expect(card.source).toBe('fallback');
    expect(card.title).toBe('Свободный Промпт');
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- tests/server/resultGenerator.test.ts`

Expected: FAIL because generator does not exist.

- [ ] **Step 3: Implement GigaChat client**

Create `src/server/gigachat/client.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config';

export class GigaChatClient {
  constructor(private readonly config: AppConfig['gigachat']) {}

  isConfigured(): boolean {
    return Boolean(this.config.credentials);
  }

  async completeJson(prompt: string): Promise<unknown> {
    if (!this.config.credentials) {
      throw new Error('GigaChat credentials are not configured');
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${this.config.apiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4
      })
    });

    if (!response.ok) {
      throw new Error(`GigaChat completion failed: ${response.status}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('GigaChat returned empty content');
    }
    return JSON.parse(extractJson(content));
  }

  private async getAccessToken(): Promise<string> {
    const response = await fetch(this.config.authUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${this.config.credentials}`,
        RqUID: randomUUID(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ scope: this.config.scope })
    });

    if (!response.ok) {
      throw new Error(`GigaChat auth failed: ${response.status}`);
    }

    const data: any = await response.json();
    if (!data.access_token) {
      throw new Error('GigaChat auth returned no access_token');
    }
    return data.access_token;
  }
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  throw new Error('GigaChat content does not contain JSON');
}
```

- [ ] **Step 4: Implement result generator**

Create `src/server/result-cards/generator.ts`:

```ts
import type { AppConfig } from '../config';
import { GigaChatClient } from '../gigachat/client';
import type { QuestId, ResultCard, TranscriptItem } from '../../shared/types';
import { buildFallbackCard } from './fallback';

interface GenerateResultInput {
  questId: QuestId;
  transcript: TranscriptItem[];
  gigachat: AppConfig['gigachat'];
}

export async function generateResultCard(input: GenerateResultInput): Promise<ResultCard> {
  const client = new GigaChatClient(input.gigachat);
  if (!client.isConfigured()) {
    return buildFallbackCard(input.questId, input.transcript);
  }

  try {
    const json = await client.completeJson(buildCardPrompt(input.questId, input.transcript));
    return normalizeResultCard(input.questId, json);
  } catch {
    return buildFallbackCard(input.questId, input.transcript);
  }
}

function buildCardPrompt(questId: QuestId, transcript: TranscriptItem[]): string {
  return `Сгенерируй итоговую карточку демо-звонка на русском языке.
Верни только JSON без markdown.
questId: ${questId}
transcript:
${transcript.map((item) => `${item.source}: ${item.text}`).join('\n')}`;
}

function normalizeResultCard(questId: QuestId, value: unknown): ResultCard {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid result card JSON');
  }
  const record = value as Record<string, unknown>;
  return {
    questId,
    source: 'gigachat',
    title: String(record.title ?? 'Итоговая карточка'),
    fields: Object.fromEntries(
      Object.entries(record).filter(([key]) => key !== 'title').map(([key, field]) => [key, normalizeField(field)])
    )
  };
}

function normalizeField(value: unknown): string | string[] | number {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'number') return value;
  return String(value ?? '');
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/server/resultGenerator.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/gigachat src/server/result-cards/generator.ts tests/server/resultGenerator.test.ts
git commit -m "feat: add GigaChat result generation"
```

## Task 8: React Comic-Terminal Dashboard

**Files:**
- Create: `src/client/index.html`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/styles.css`

- [ ] **Step 1: Create client entry**

Create `src/client/index.html`:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Конференц-бот звонит</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

Create `src/client/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 2: Implement dashboard**

Create `src/client/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { CallSessionSnapshot, QuestDefinition, ResultCard, ServerEvent, TranscriptItem } from '../shared/types';

interface QuestsResponse {
  quests: QuestDefinition[];
  voices: string[];
}

export function App() {
  const [quests, setQuests] = useState<QuestDefinition[]>([]);
  const [voices, setVoices] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [questId, setQuestId] = useState('it-archetype');
  const [voice, setVoice] = useState('Bik-Freespeech_8000');
  const [customPrompt, setCustomPrompt] = useState('');
  const [session, setSession] = useState<CallSessionSnapshot | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [resultCard, setResultCard] = useState<ResultCard | null>(null);

  useEffect(() => {
    fetch('/api/quests')
      .then((response) => response.json())
      .then((data: QuestsResponse) => {
        setQuests(data.quests);
        setVoices(data.voices);
        setVoice(data.voices[0] ?? 'Bik-Freespeech_8000');
      });
  }, []);

  async function startCall() {
    const response = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber,
        questId,
        voice,
        customPrompt: questId === 'custom' ? customPrompt : null
      })
    });
    const nextSession = await response.json();
    if (!response.ok) {
      alert(nextSession.message ?? 'Не удалось запустить звонок');
      return;
    }
    setSession(nextSession);
    setTranscript(nextSession.transcript ?? []);
    setResultCard(null);
    const events = new EventSource(`/api/calls/${nextSession.sessionId}/events`);
    events.onmessage = (event) => console.log(event.data);
    for (const type of ['status', 'transcription', 'resultCard', 'error']) {
      events.addEventListener(type, (event) => {
        const parsed = JSON.parse((event as MessageEvent).data) as ServerEvent;
        if (parsed.type === 'status') setSession(parsed.session);
        if (parsed.type === 'transcription') setTranscript((items) => [...items, parsed.item]);
        if (parsed.type === 'resultCard') setResultCard(parsed.card);
        if (parsed.type === 'error') alert(parsed.message);
      });
    }
  }

  async function interruptCall() {
    if (!session) return;
    await fetch(`/api/calls/${session.sessionId}/interrupt`, { method: 'POST' });
  }

  const selectedQuest = quests.find((quest) => quest.id === questId);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GigaCaller demo</p>
          <h1>Конференц-бот звонит</h1>
        </div>
        <div className="statusBox">
          <span>Статус</span>
          <strong>{session?.status ?? 'готов'}</strong>
        </div>
      </header>

      <section className="grid">
        <aside className="panel controls">
          <h2>Запуск</h2>
          <label>Номер участника</label>
          <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+7..." />

          <label>Режим</label>
          <div className="questList">
            {quests.map((quest) => (
              <button key={quest.id} className={quest.id === questId ? 'selected' : ''} onClick={() => setQuestId(quest.id)}>
                <strong>{quest.title}</strong>
                <span>{quest.description}</span>
              </button>
            ))}
          </div>

          {questId === 'custom' && (
            <>
              <label>Свободный промпт</label>
              <textarea value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} />
              <p className="warning">Не вводите сценарии для обмана, сбора секретов или звонков третьим лицам.</p>
            </>
          )}

          <label>Голос</label>
          <select value={voice} onChange={(event) => setVoice(event.target.value)}>
            {voices.map((item) => <option key={item}>{item}</option>)}
          </select>

          <button className="primary" onClick={startCall}>Позвонить</button>
          <button className="secondary" onClick={interruptCall} disabled={!session}>Завершить звонок</button>
        </aside>

        <section className="panel transcript">
          <h2>{selectedQuest?.title ?? 'Live transcript'}</h2>
          <div className="messages">
            {transcript.length === 0 && <p className="empty">Реплики появятся здесь во время звонка.</p>}
            {transcript.map((item) => (
              <article key={item.id} className={`message ${item.source}`}>
                <span>{item.source === 'user' ? 'Участник' : 'Агент'}</span>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel result">
          <h2>Карточка</h2>
          {!resultCard && <p className="empty">После звонка здесь появится итог квеста.</p>}
          {resultCard && (
            <div className="resultCard">
              <small>{resultCard.source === 'gigachat' ? 'GigaChat' : 'локальный fallback'}</small>
              <h3>{resultCard.title}</h3>
              {Object.entries(resultCard.fields).map(([key, value]) => (
                <div key={key} className="field">
                  <b>{key}</b>
                  <span>{Array.isArray(value) ? value.join(', ') : value}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Implement comic-terminal CSS**

Create `src/client/styles.css`:

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, Arial, sans-serif;
  background: #fbfbff;
  color: #141414;
}
.shell { min-height: 100vh; padding: 24px; }
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 4px solid #141414;
  box-shadow: 7px 7px 0 #141414;
  background: #7cf7c7;
  border-radius: 8px;
  padding: 18px 22px;
  margin-bottom: 22px;
}
.eyebrow { margin: 0 0 4px; font-weight: 900; text-transform: uppercase; }
h1, h2, h3, p { margin-top: 0; }
h1 { margin-bottom: 0; font-size: 34px; }
.statusBox {
  border: 3px solid #141414;
  background: #fff;
  border-radius: 8px;
  padding: 10px 14px;
  min-width: 150px;
}
.statusBox span { display: block; font-size: 12px; font-weight: 900; }
.statusBox strong { font-size: 22px; }
.grid {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr) 340px;
  gap: 18px;
}
.panel {
  border: 4px solid #141414;
  box-shadow: 7px 7px 0 #141414;
  border-radius: 8px;
  background: #fff;
  padding: 18px;
  min-height: 640px;
}
.controls { background: #ffd166; }
.transcript { background: #fff; }
.result { background: #ff8bd1; }
label {
  display: block;
  font-weight: 900;
  margin: 14px 0 6px;
}
input, select, textarea {
  width: 100%;
  border: 3px solid #141414;
  border-radius: 8px;
  padding: 12px;
  font: inherit;
  background: #fff;
}
textarea { min-height: 120px; resize: vertical; }
button {
  border: 3px solid #141414;
  border-radius: 8px;
  padding: 12px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 4px 4px 0 #141414;
}
.questList { display: grid; gap: 10px; }
.questList button {
  background: #fff;
  text-align: left;
}
.questList button span {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 500;
}
.questList .selected { background: #9bdcff; }
.primary {
  width: 100%;
  margin-top: 18px;
  background: #7cf7c7;
}
.secondary {
  width: 100%;
  margin-top: 10px;
  background: #fff;
}
.warning { font-size: 13px; font-weight: 800; }
.messages {
  display: grid;
  gap: 12px;
  max-height: 560px;
  overflow: auto;
}
.message {
  border: 3px solid #141414;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 4px 4px 0 #141414;
}
.message span { font-weight: 900; font-size: 12px; text-transform: uppercase; }
.message.user { background: #9bdcff; }
.message.model { background: #7cf7c7; }
.message.unknown { background: #eee; }
.empty {
  border: 3px dashed #141414;
  border-radius: 8px;
  padding: 18px;
  font-weight: 800;
}
.resultCard {
  background: #fff;
  border: 3px solid #141414;
  border-radius: 8px;
  padding: 16px;
}
.resultCard small {
  font-weight: 900;
  text-transform: uppercase;
}
.field {
  margin-top: 12px;
}
.field b {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
}
@media (max-width: 1100px) {
  .grid { grid-template-columns: 1fr; }
  .panel { min-height: auto; }
}
```

- [ ] **Step 4: Build client**

Run: `npm run build`

Expected: PASS and `dist/client` exists.

- [ ] **Step 5: Commit**

```bash
git add src/client
git commit -m "feat: add comic terminal dashboard"
```

## Task 9: Wire Result Generation Into Call Lifecycle

**Files:**
- Modify: `src/server/routes/calls.ts`
- Test: `tests/server/routes.test.ts`

- [ ] **Step 1: Add route test expectation for missing GigaChat fallback**

Modify `tests/server/routes.test.ts` by adding:

```ts
  it('creates session snapshots for valid requests', async () => {
    const app = buildApp({ config });
    const response = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '+79990000000',
        questId: 'custom',
        voice: 'Bik-Freespeech_8000',
        customPrompt: 'Проведи короткий демо-разговор'
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().questId).toBe('custom');
  });
```

- [ ] **Step 2: Run test**

Run: `npm test -- tests/server/routes.test.ts`

Expected: existing route may try to open real gateway. If it does, refactor `buildApp` to accept a `gatewayFactory` dependency before making the test pass.

- [ ] **Step 3: Refactor gateway dependency for testability**

Modify `src/server/routes/calls.ts` so `registerCallRoutes` accepts `gatewayFactory`, defaulting to `GatewayClient`. The factory type:

```ts
type GatewayFactory = (options: GatewayClientOptions) => Pick<GatewayClient, 'connect' | 'sendInitialRequest' | 'interrupt' | 'close'>;
```

In tests, pass a fake that calls `options.onMessage({ type: 'ready', requestId: 'req-test' })` asynchronously from `connect`.

- [ ] **Step 4: Generate card on terminal statuses**

In `src/server/routes/calls.ts`, add helper:

```ts
async function finishSession(sessionId: string, deps: { sessions: SessionStore; config: AppConfig }) {
  const snapshot = deps.sessions.get(sessionId);
  if (!snapshot || snapshot.resultCard) return;
  const card = await generateResultCard({
    questId: snapshot.questId,
    transcript: snapshot.transcript,
    gigachat: deps.config.gigachat
  });
  deps.sessions.setResultCard(sessionId, card);
}
```

Call it when normalized status is `completed`, `noAnswer`, `failed`, or when gateway closes.

- [ ] **Step 5: Run full server tests**

Run: `npm test -- tests/server`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/routes/calls.ts tests/server/routes.test.ts
git commit -m "feat: generate result cards on call completion"
```

## Task 10: Final Verification And Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Expand README**

Add sections:

```md
## Configuration

- `GIGACALLER_GATEWAY_WS_URL`: base WebSocket URL for GigaCaller Gateway.
- `DEFAULT_RETRY`: retry string sent to gateway, defaults to `0`.
- `DEFAULT_VOICE`: default freespeech voice.
- `GIGACHAT_CREDENTIALS`: optional Basic authorization key for GigaChat.

## Demo Flow

1. Open the dashboard.
2. Enter a consenting participant phone number.
3. Pick a quest or write a safe custom prompt.
4. Pick a freespeech voice.
5. Click "Позвонить".
6. Watch live transcript and wait for the result card.

## Limitations

- No persistent database.
- Binary audio is ignored.
- The app does not modify GigaCaller services.
- Custom `agentFunctions` cannot be passed through the current gateway contract.
```

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Start dev server**

Run: `npm run dev`

Expected: server listens on `http://localhost:3000`. Leave it running only long enough to verify the UI.

- [ ] **Step 5: Browser smoke test**

Open `http://localhost:3000`.

Expected:
- dashboard loads;
- quest list renders;
- freespeech voice select renders;
- phone input renders;
- no visual overlap at desktop width;
- mobile width stacks panels into one column.

- [ ] **Step 6: Commit final docs**

```bash
git add README.md
git commit -m "docs: document local demo flow"
```

## Self-Review Checklist

- Spec coverage:
  - REST commands: Tasks 6 and 9.
  - SSE live events: Task 6.
  - Gateway WebSocket: Task 5 and Task 6.
  - Prompt templates and free prompt wrapper: Task 3.
  - Freespeech voice allowlist: Task 3 and Task 6.
  - Result cards with GigaChat and fallback: Task 4, Task 7, Task 9.
  - Comic-terminal UI: Task 8.
  - Local setup: Task 1 and Task 10.
  - No GigaCaller code changes: all tasks touch only this repo.
- Placeholder scan: no incomplete placeholder steps are present.
- Type consistency:
  - `QuestId`, `ResultCard`, `TranscriptItem`, `CallSessionSnapshot` are defined in Task 2 and reused by subsequent tasks.
  - REST route names match the approved spec.
  - Voice names match gateway freespeech values.
