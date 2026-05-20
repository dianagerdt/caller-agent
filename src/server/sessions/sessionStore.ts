import { randomUUID } from 'node:crypto';
import type {
  CallSessionSnapshot,
  CallStatus,
  QuestId,
  ResultCard,
  ServerEvent,
  TechnicalEvent,
  TranscriptItem,
  TranscriptSource
} from '../../shared/types';

interface CreateSessionInput {
  questId: QuestId;
  voice: string;
}

interface AddTranscriptInput {
  source: TranscriptSource;
  text: string;
  seqNum?: number;
}

interface AddTechnicalEventInput {
  level: TechnicalEvent['level'];
  message: string;
  details?: unknown;
}

type SessionListener = (event: ServerEvent) => void;

export class SessionStore {
  private readonly sessions = new Map<string, CallSessionSnapshot>();
  private readonly listeners = new Map<string, Set<SessionListener>>();

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
    return this.cloneSession(session);
  }

  get(sessionId: string): CallSessionSnapshot | undefined {
    const session = this.sessions.get(sessionId);
    return session ? this.cloneSession(session) : undefined;
  }

  setRequestId(sessionId: string, requestId: string): CallSessionSnapshot {
    const session = this.requireSession(sessionId);
    session.requestId = requestId;
    this.touch(session);
    return this.cloneSession(session);
  }

  setCallId(sessionId: string, callId: string): CallSessionSnapshot {
    const session = this.requireSession(sessionId);
    session.callId = callId;
    this.touch(session);
    return this.cloneSession(session);
  }

  setStatus(sessionId: string, status: CallStatus): CallSessionSnapshot {
    const session = this.requireSession(sessionId);
    session.status = status;
    this.touch(session);
    const snapshot = this.cloneSession(session);
    this.emit(sessionId, { type: 'status', session: snapshot });
    return snapshot;
  }

  addTranscript(sessionId: string, input: AddTranscriptInput): TranscriptItem {
    const session = this.requireSession(sessionId);
    const item: TranscriptItem = {
      id: randomUUID(),
      source: input.source,
      text: input.text,
      timestamp: Date.now(),
      ...(input.seqNum === undefined ? {} : { seqNum: input.seqNum })
    };

    session.transcript.push(item);
    this.touch(session);
    const clonedItem = this.cloneTranscriptItem(item);
    this.emit(sessionId, { type: 'transcription', item: clonedItem });
    return clonedItem;
  }

  addTechnicalEvent(sessionId: string, input: AddTechnicalEventInput): TechnicalEvent {
    const session = this.requireSession(sessionId);
    const event: TechnicalEvent = {
      id: randomUUID(),
      level: input.level,
      message: input.message,
      timestamp: Date.now(),
      ...(input.details === undefined ? {} : { details: this.cloneUnknown(input.details) })
    };

    session.technicalEvents.push(event);
    this.touch(session);
    const clonedEvent = this.cloneTechnicalEvent(event);
    this.emit(sessionId, { type: 'technicalEvent', event: clonedEvent });
    return clonedEvent;
  }

  setResultCard(sessionId: string, resultCard: ResultCard): CallSessionSnapshot {
    const session = this.requireSession(sessionId);
    session.resultCard = this.cloneResultCard(resultCard);
    this.touch(session);
    const card = this.cloneResultCard(session.resultCard);
    this.emit(sessionId, { type: 'resultCard', card });
    return this.cloneSession(session);
  }

  subscribe(sessionId: string, listener: SessionListener): () => void {
    const sessionListeners = this.listeners.get(sessionId) ?? new Set<SessionListener>();
    sessionListeners.add(listener);
    this.listeners.set(sessionId, sessionListeners);

    return () => {
      sessionListeners.delete(listener);
      if (sessionListeners.size === 0) {
        this.listeners.delete(sessionId);
      }
    };
  }

  private requireSession(sessionId: string): CallSessionSnapshot {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session;
  }

  private touch(session: CallSessionSnapshot): void {
    session.updatedAt = Date.now();
  }

  private emit(sessionId: string, event: ServerEvent): void {
    const sessionListeners = this.listeners.get(sessionId);
    if (!sessionListeners) {
      return;
    }

    for (const listener of sessionListeners) {
      listener(this.cloneEvent(event));
    }
  }

  private cloneSession(session: CallSessionSnapshot): CallSessionSnapshot {
    return {
      ...session,
      transcript: session.transcript.map((item) => this.cloneTranscriptItem(item)),
      technicalEvents: session.technicalEvents.map((event) => this.cloneTechnicalEvent(event)),
      ...(session.resultCard ? { resultCard: this.cloneResultCard(session.resultCard) } : {})
    };
  }

  private cloneTranscriptItem(item: TranscriptItem): TranscriptItem {
    return { ...item };
  }

  private cloneTechnicalEvent(event: TechnicalEvent): TechnicalEvent {
    return {
      ...event,
      ...(event.details === undefined ? {} : { details: this.cloneUnknown(event.details) })
    };
  }

  private cloneResultCard(card: ResultCard): ResultCard {
    return {
      ...card,
      fields: Object.fromEntries(
        Object.entries(card.fields).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])
      )
    };
  }

  private cloneEvent(event: ServerEvent): ServerEvent {
    switch (event.type) {
      case 'status':
        return { type: 'status', session: this.cloneSession(event.session) };
      case 'transcription':
        return { type: 'transcription', item: this.cloneTranscriptItem(event.item) };
      case 'technicalEvent':
        return { type: 'technicalEvent', event: this.cloneTechnicalEvent(event.event) };
      case 'resultCard':
        return { type: 'resultCard', card: this.cloneResultCard(event.card) };
      case 'functionCall':
        return { type: 'functionCall', data: this.cloneUnknown(event.data) };
      case 'error':
        return {
          ...event,
          ...(event.details === undefined ? {} : { details: this.cloneUnknown(event.details) })
        };
    }
  }

  private cloneUnknown<T>(value: T): T {
    if (value === undefined || value === null) {
      return value;
    }

    return structuredClone(value);
  }
}
