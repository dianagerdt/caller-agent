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

  it('continues delivering an event when an earlier listener throws', () => {
    const store = new SessionStore();
    const session = store.create({
      questId: 'it-archetype',
      voice: 'Bik-Freespeech_8000'
    });
    const eventTypes: string[] = [];

    store.subscribe(session.sessionId, () => {
      throw new Error('listener failed');
    });
    store.subscribe(session.sessionId, (event) => {
      eventTypes.push(event.type);
    });

    expect(() => store.setStatus(session.sessionId, 'answered')).not.toThrow();
    expect(eventTypes).toEqual(['status']);
  });

  it('does not deliver the active event to a listener subscribed during fanout', () => {
    const store = new SessionStore();
    const session = store.create({
      questId: 'it-archetype',
      voice: 'Bik-Freespeech_8000'
    });
    const eventTypes: string[] = [];

    store.subscribe(session.sessionId, () => {
      store.subscribe(session.sessionId, (event) => {
        eventTypes.push(event.type);
      });
    });

    store.setStatus(session.sessionId, 'answered');
    expect(eventTypes).toEqual([]);

    store.setStatus(session.sessionId, 'completed');
    expect(eventTypes).toEqual(['status']);
  });

  it('delivers the active event to a listener unsubscribed during fanout', () => {
    const store = new SessionStore();
    const session = store.create({
      questId: 'it-archetype',
      voice: 'Bik-Freespeech_8000'
    });
    const eventTypes: string[] = [];
    let unsubscribeSecond = () => {};

    store.subscribe(session.sessionId, () => {
      unsubscribeSecond();
    });
    unsubscribeSecond = store.subscribe(session.sessionId, (event) => {
      eventTypes.push(event.type);
    });

    store.setStatus(session.sessionId, 'answered');
    expect(eventTypes).toEqual(['status']);

    store.setStatus(session.sessionId, 'completed');
    expect(eventTypes).toEqual(['status']);
  });
});
