import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CallSessionSnapshot,
  QuestDefinition,
  QuestId,
  ResultCard,
  ServerEvent,
  TranscriptItem
} from '../shared/types';

interface QuestResponse {
  quests: QuestDefinition[];
  voices: string[];
}

type RequestState = 'idle' | 'loading' | 'calling' | 'error';

const terminalStatuses = new Set<CallSessionSnapshot['status']>([
  'completed',
  'noAnswer',
  'failed',
  'closed',
  'interrupted'
]);

const statusLabels: Record<CallSessionSnapshot['status'], string> = {
  idle: 'Ожидание',
  connecting: 'Соединяем',
  published: 'Заявка ушла',
  ringing: 'Звоним',
  answered: 'На линии',
  completed: 'Завершен',
  noAnswer: 'Нет ответа',
  failed: 'Ошибка',
  closed: 'Закрыт',
  interrupted: 'Прерван'
};

export function App() {
  const [quests, setQuests] = useState<QuestDefinition[]>([]);
  const [voices, setVoices] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [questId, setQuestId] = useState<QuestId>('it-archetype');
  const [voice, setVoice] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [session, setSession] = useState<CallSessionSnapshot | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [resultCard, setResultCard] = useState<ResultCard | null>(null);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [message, setMessage] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const transcriptWindowRef = useRef<HTMLDivElement | null>(null);
  const activeStartRequestRef = useRef(0);
  const currentSessionIdRef = useRef<string | null>(null);

  const selectedQuest = useMemo(
    () => quests.find((quest) => quest.id === questId),
    [questId, quests]
  );
  const isCallActive = Boolean(session && !terminalStatuses.has(session.status) && !resultCard);
  const isStartDisabled = requestState === 'calling' || isCallActive || !voice;

  useEffect(() => {
    let active = true;

    async function loadQuests() {
      try {
        const response = await fetch('/api/quests');
        if (!response.ok) {
          throw new Error(`Quests request failed: ${response.status}`);
        }
        const data = (await response.json()) as QuestResponse;
        if (!active) {
          return;
        }
        setQuests(data.quests);
        setVoices(data.voices);
        setQuestId(data.quests[0]?.id ?? 'custom');
        setVoice(data.voices[0] ?? '');
        setRequestState('idle');
      } catch (error) {
        if (!active) {
          return;
        }
        setRequestState('error');
        setMessage(error instanceof Error ? error.message : 'Не удалось загрузить квесты');
      }
    }

    loadQuests();

    return () => {
      active = false;
      activeStartRequestRef.current += 1;
      currentSessionIdRef.current = null;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const transcriptWindow = transcriptWindowRef.current;
    if (!transcriptWindow) {
      return;
    }

    transcriptWindow.scrollTo({
      top: transcriptWindow.scrollHeight,
      behavior: transcript.length > 1 ? 'smooth' : 'auto'
    });
  }, [transcript.length]);

  async function startCall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isStartDisabled) {
      return;
    }

    const startRequestId = activeStartRequestRef.current + 1;
    activeStartRequestRef.current = startRequestId;
    currentSessionIdRef.current = null;
    setRequestState('calling');
    setMessage('');
    setTranscript([]);
    setResultCard(null);
    setSession(null);
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    try {
      const payload = {
        phoneNumber,
        questId,
        voice,
        ...(questId === 'custom' ? { customPrompt } : {})
      };
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as CallSessionSnapshot | { message?: string };
      if (!response.ok) {
        throw new Error('message' in data && data.message ? data.message : `Call request failed: ${response.status}`);
      }
      if (activeStartRequestRef.current !== startRequestId) {
        return;
      }

      const nextSession = data as CallSessionSnapshot;
      currentSessionIdRef.current = nextSession.sessionId;
      setSession(nextSession);
      setTranscript(nextSession.transcript);
      setResultCard(nextSession.resultCard ?? null);
      setRequestState('idle');
      openCallEvents(nextSession.sessionId, startRequestId);
    } catch (error) {
      if (activeStartRequestRef.current !== startRequestId) {
        return;
      }
      setRequestState('error');
      setMessage(error instanceof Error ? error.message : 'Не удалось запустить звонок');
    }
  }

  function openCallEvents(sessionId: string, startRequestId: number) {
    eventSourceRef.current?.close();
    const events = new EventSource(`/api/calls/${sessionId}/events`);
    eventSourceRef.current = events;

    function isCurrentStream() {
      return (
        eventSourceRef.current === events &&
        activeStartRequestRef.current === startRequestId &&
        currentSessionIdRef.current === sessionId
      );
    }

    function closeCurrentStream() {
      if (eventSourceRef.current === events) {
        events.close();
        eventSourceRef.current = null;
      }
    }

    events.addEventListener('status', (event) => {
      if (!isCurrentStream()) {
        events.close();
        return;
      }
      const payload = JSON.parse(event.data) as Extract<ServerEvent, { type: 'status' }>;
      setSession(payload.session);
      setTranscript(payload.session.transcript);
      setResultCard(payload.session.resultCard ?? null);
      if (payload.session.status === 'closed' || (terminalStatuses.has(payload.session.status) && payload.session.resultCard)) {
        closeCurrentStream();
      }
    });

    events.addEventListener('transcription', (event) => {
      if (!isCurrentStream()) {
        events.close();
        return;
      }
      const payload = JSON.parse(event.data) as Extract<ServerEvent, { type: 'transcription' }>;
      setTranscript((current) => {
        if (current.some((item) => item.id === payload.item.id)) {
          return current;
        }
        return [...current, payload.item];
      });
    });

    events.addEventListener('resultCard', (event) => {
      if (!isCurrentStream()) {
        events.close();
        return;
      }
      const payload = JSON.parse(event.data) as Extract<ServerEvent, { type: 'resultCard' }>;
      setResultCard(payload.card);
      closeCurrentStream();
    });

    events.addEventListener('error', (event) => {
      if (!isCurrentStream()) {
        events.close();
        return;
      }
      try {
        const payload = JSON.parse((event as MessageEvent).data) as Extract<ServerEvent, { type: 'error' }>;
        setMessage(payload.message);
      } catch {
        setMessage('Поток событий прерван');
      }
      setRequestState('error');
      closeCurrentStream();
    });

    events.onerror = () => {
      if (!isCurrentStream()) {
        events.close();
        return;
      }
      setMessage('Поток событий недоступен');
      setRequestState('error');
      closeCurrentStream();
    };
  }

  async function interruptCall() {
    if (!session) {
      return;
    }

    setMessage('');
    try {
      const response = await fetch(`/api/calls/${session.sessionId}/interrupt`, {
        method: 'POST'
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? `Interrupt failed: ${response.status}`);
      }
    } catch (error) {
      setRequestState('error');
      setMessage(error instanceof Error ? error.message : 'Не удалось прервать звонок');
    }
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">GigaCaller Агент</p>
          <h1>Комикс-терминал</h1>
        </div>
        <div className={`status-pill status-${session?.status ?? 'idle'}`}>
          {statusLabels[session?.status ?? 'idle']}
        </div>
      </header>

      <section className="dashboard-grid" aria-label="Панель управления звонком">
        <form className="panel launch-panel" onSubmit={startCall}>
          <div className="panel-title">
            <span>01</span>
            <h2>Запуск</h2>
          </div>

          <label>
            <span>Телефон</span>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+7 999 123-45-67"
              required
            />
          </label>

          <label>
            <span>Квест</span>
            <select value={questId} onChange={(event) => setQuestId(event.target.value as QuestId)}>
              {quests.map((quest) => (
                <option key={quest.id} value={quest.id}>
                  {quest.title}
                </option>
              ))}
              {!quests.some((quest) => quest.id === 'custom') && <option value="custom">Свободный сценарий</option>}
            </select>
          </label>

          <label>
            <span>Голос</span>
            <select value={voice} onChange={(event) => setVoice(event.target.value)} required>
              {voices.map((voiceOption) => (
                <option key={voiceOption} value={voiceOption}>
                  {voiceOption}
                </option>
              ))}
            </select>
          </label>

          {questId === 'custom' ? (
            <label>
              <span>Свободный промпт</span>
              <textarea
                value={customPrompt}
                onChange={(event) => setCustomPrompt(event.target.value)}
                placeholder="Опишите безопасный короткий демо-сценарий"
                rows={7}
              />
            </label>
          ) : (
            <div className="quest-card" style={{ borderColor: selectedQuest?.accentColor }}>
              <strong>{selectedQuest?.title ?? 'Квест'}</strong>
              <p>{selectedQuest?.description ?? 'Выберите сценарий звонка.'}</p>
            </div>
          )}

          <p className="warning">
            Свободный промпт остается демо-сценарием: не просите секреты, коды, документы и не имитируйте реальные
            организации.
          </p>

          {message ? <p className="error-line">{message}</p> : null}

          <div className="button-row">
            <button type="submit" disabled={isStartDisabled}>
              {requestState === 'calling' ? 'Запускаем...' : isCallActive ? 'Звонок идет' : 'Старт звонка'}
            </button>
            <button type="button" className="secondary-button" onClick={interruptCall} disabled={!session}>
              Прервать
            </button>
          </div>
        </form>

        <section className="panel transcript-panel" aria-label="Живая расшифровка">
          <div className="panel-title">
            <span>02</span>
            <h2>Живая расшифровка</h2>
          </div>
          <div className="terminal-window" ref={transcriptWindowRef}>
            {transcript.length === 0 ? (
              <p className="empty-state">Здесь появятся реплики участника и агента.</p>
            ) : (
              transcript.map((item) => (
                <article className={`transcript-line source-${item.source}`} key={item.id}>
                  <span>{item.source}</span>
                  <p>{item.text}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="panel result-panel" aria-label="Итоговая карточка">
          <div className="panel-title">
            <span>03</span>
            <h2>Итоговая карточка</h2>
          </div>
          {resultCard ? (
            <div className="result-card">
              <p className="eyebrow">{resultCard.source}</p>
              <h3>{resultCard.title}</h3>
              <dl>
                {Object.entries(resultCard.fields).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{Array.isArray(value) ? value.join(', ') : value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="empty-state">Финальная карточка появится после завершения квеста.</p>
          )}
        </aside>
      </section>
    </main>
  );
}
