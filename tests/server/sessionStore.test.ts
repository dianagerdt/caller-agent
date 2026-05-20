import { describe, expect, it } from 'vitest';
import { SessionStore } from '../../src/server/sessions/sessionStore';

describe('SessionStore', () => {
  it('creates and updates a session snapshot', () => {
    const store = new SessionStore();

    const session = store.create({
      questId: 'it-archetype',
      voice: 'Bik-Freespeech_8000'
    });
    store.setRequestId(session.sessionId, 'req-1');
    store.setStatus(session.sessionId, 'answered');
    store.addTranscript(session.sessionId, {
      source: 'user',
      text: 'Привет',
      seqNum: 1
    });

    const snapshot = store.get(session.sessionId);

    expect(snapshot?.requestId).toBe('req-1');
    expect(snapshot?.status).toBe('answered');
    expect(snapshot?.transcript).toHaveLength(1);
    expect(snapshot?.transcript[0]).toMatchObject({
      source: 'user',
      text: 'Привет',
      seqNum: 1
    });
  });

  it('returns cloned snapshots so callers cannot mutate internal state', () => {
    const store = new SessionStore();
    const session = store.create({
      questId: 'it-archetype',
      voice: 'Bik-Freespeech_8000'
    });
    store.addTranscript(session.sessionId, {
      source: 'user',
      text: 'immutable please'
    });

    const snapshot = store.get(session.sessionId);
    snapshot?.transcript.push({
      id: 'external',
      source: 'model',
      text: 'mutated',
      timestamp: 123
    });

    expect(store.get(session.sessionId)?.transcript).toHaveLength(1);
    expect(store.get(session.sessionId)?.transcript[0].text).toBe('immutable please');
  });

  it('emits events to subscribers and stops after unsubscribe', () => {
    const store = new SessionStore();
    const session = store.create({
      questId: 'it-archetype',
      voice: 'Bik-Freespeech_8000'
    });
    const eventTypes: string[] = [];
    const unsubscribe = store.subscribe(session.sessionId, (event) => {
      eventTypes.push(event.type);
    });

    store.setStatus(session.sessionId, 'answered');
    store.addTranscript(session.sessionId, {
      source: 'user',
      text: 'Привет'
    });
    unsubscribe();
    store.addTechnicalEvent(session.sessionId, {
      level: 'info',
      message: 'ignored'
    });

    expect(eventTypes).toEqual(['status', 'transcription']);
  });
});
