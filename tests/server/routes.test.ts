import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/server/app';
import { loadConfig } from '../../src/server/config';
import type { GatewayClientOptions } from '../../src/server/gigacaller/gatewayClient';

function createFakeGatewayFactory() {
  let options: GatewayClientOptions | undefined;
  const gateway = {
    connect: vi.fn(),
    sendInitialRequest: vi.fn(),
    interrupt: vi.fn(),
    close: vi.fn()
  };

  return {
    gateway,
    get options() {
      if (!options) {
        throw new Error('Gateway was not created');
      }

      return options;
    },
    factory: vi.fn((nextOptions: GatewayClientOptions) => {
      options = nextOptions;
      return gateway;
    })
  };
}

describe('server routes', () => {
  const config = loadConfig({
    GIGACALLER_GATEWAY_WS_URL: 'ws://localhost:9999'
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns quest definitions and supported voices', async () => {
    const app = buildApp({ config });

    const response = await app.inject({
      method: 'GET',
      url: '/api/quests'
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      voices: expect.arrayContaining(['Bik-Freespeech_8000'])
    });
  });

  it('rejects unsupported call voices', async () => {
    const app = buildApp({ config });

    const response = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '+7 999 123-45-67',
        questId: 'it-archetype',
        voice: 'Krn_8000'
      }
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: expect.stringContaining('Unsupported voice')
    });
  });

  it('creates session snapshots for valid requests and preserves gateway phone format', async () => {
    const fakeGateway = createFakeGatewayFactory();
    const app = buildApp({
      config: {
        ...config,
        gigacallerGatewayAuth: {
          username: 'demo-user',
          password: 'demo-password'
        }
      },
      gatewayFactory: fakeGateway.factory
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '+79990000000',
        questId: 'custom',
        voice: 'Bik-Freespeech_8000',
        customPrompt: '  Проведи короткий демо-разговор\nбез наших системных добавок  '
      }
    });

    await app.close();

    expect(response.statusCode).toBe(202);
    expect(response.json().questId).toBe('custom');
    expect(fakeGateway.gateway.connect).toHaveBeenCalledOnce();
    expect(fakeGateway.options.auth).toEqual({
      username: 'demo-user',
      password: 'demo-password'
    });

    fakeGateway.options.onMessage({
      type: 'ready',
      requestId: 'request-1'
    });

    expect(fakeGateway.gateway.sendInitialRequest).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '+79990000000',
      systemPrompt: '  Проведи короткий демо-разговор\nбез наших системных добавок  '
    }));
  });

  it('accepts Russian local 8-prefixed phone numbers', async () => {
    const fakeGateway = createFakeGatewayFactory();
    const app = buildApp({ config, gatewayFactory: fakeGateway.factory });
    const response = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '8 (999) 000-00-00',
        questId: 'custom',
        voice: 'Bik-Freespeech_8000',
        customPrompt: 'Проведи короткий демо-разговор'
      }
    });

    fakeGateway.options.onMessage({
      type: 'ready',
      requestId: 'request-1'
    });

    await app.close();

    expect(response.statusCode).toBe(202);
    expect(fakeGateway.gateway.sendInitialRequest).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: '89990000000'
    }));
  });

  it('creates fallback result card when gateway reports terminal status', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const fakeGateway = createFakeGatewayFactory();
    const app = buildApp({ config, gatewayFactory: fakeGateway.factory });
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '+79990000000',
        questId: 'custom',
        voice: 'Bik-Freespeech_8000',
        customPrompt: 'Проведи короткий демо-разговор'
      }
    });
    const { sessionId } = createResponse.json();

    fakeGateway.options.onMessage({
      type: 'transcription',
      source: 'user',
      text: 'Привет, это тестовый разговор',
      seqNum: 1,
      callId: 'call-1'
    });
    fakeGateway.options.onMessage({
      type: 'status',
      status: 'completed',
      requestId: 'request-1',
      callId: 'call-1',
      data: {}
    });

    await vi.waitFor(async () => {
      const sessionResponse = await app.inject({
        method: 'GET',
        url: `/api/calls/${sessionId}`
      });

      expect(sessionResponse.json().resultCard).toMatchObject({
        questId: 'custom',
        source: 'fallback',
        title: 'Свободный Промпт'
      });
    });

    await app.close();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('streams result card events after terminal gateway status', async () => {
    const fakeGateway = createFakeGatewayFactory();
    const app = buildApp({ config, gatewayFactory: fakeGateway.factory });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '+79990000000',
        questId: 'custom',
        voice: 'Bik-Freespeech_8000',
        customPrompt: 'Проведи короткий демо-разговор'
      }
    });
    const { sessionId } = createResponse.json();
    const eventResponsePromise = app.inject({
      method: 'GET',
      url: `/api/calls/${sessionId}/events?once=resultCard`
    });

    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    fakeGateway.options.onMessage({
      type: 'transcription',
      source: 'user',
      text: 'Привет, это тестовый разговор',
      seqNum: 1,
      callId: 'call-1'
    });
    fakeGateway.options.onMessage({
      type: 'status',
      status: 'completed',
      requestId: 'request-1',
      callId: 'call-1',
      data: {}
    });

    const eventResponse = await eventResponsePromise;
    await app.close();

    expect(eventResponse.statusCode).toBe(200);
    const eventText = eventResponse.body;
    expect(eventText).toContain('event: resultCard');
    expect(eventText).toContain('"type":"resultCard"');
    expect(eventText).toContain('"source":"fallback"');
  });

  it('creates a result card when gateway closes after end_call function call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const fakeGateway = createFakeGatewayFactory();
    const app = buildApp({ config, gatewayFactory: fakeGateway.factory });
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '+79990000000',
        questId: 'prod-down-rpg',
        voice: 'Bik-Freespeech_8000'
      }
    });
    const { sessionId } = createResponse.json();

    fakeGateway.options.onMessage({
      type: 'transcription',
      source: 'user',
      text: 'Я проверил логи и откатил релиз',
      seqNum: 1,
      callId: 'call-1'
    });
    fakeGateway.options.onMessage({
      type: 'functionCall',
      data: {
        callId: 'call-1',
        function: {
          name: 'end_call'
        }
      }
    });
    fakeGateway.options.onClose(1000, Buffer.from('end_call'));

    await vi.waitFor(async () => {
      const sessionResponse = await app.inject({
        method: 'GET',
        url: `/api/calls/${sessionId}`
      });
      const session = sessionResponse.json();

      expect(session.status).toBe('completed');
      expect(session.resultCard).toMatchObject({
        questId: 'prod-down-rpg',
        source: 'fallback'
      });
    });

    await app.close();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not create a result card when gateway closes before terminal call status', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const fakeGateway = createFakeGatewayFactory();
    const app = buildApp({ config, gatewayFactory: fakeGateway.factory });
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '+79990000000',
        questId: 'custom',
        voice: 'Bik-Freespeech_8000',
        customPrompt: 'Проведи короткий демо-разговор'
      }
    });
    const { sessionId } = createResponse.json();

    fakeGateway.options.onMessage({
      type: 'ready',
      requestId: 'request-1'
    });
    fakeGateway.options.onClose(1006, Buffer.from('network lost'));

    const sessionResponse = await app.inject({
      method: 'GET',
      url: `/api/calls/${sessionId}`
    });

    await app.close();

    expect(sessionResponse.json()).toMatchObject({
      status: 'closed'
    });
    expect(sessionResponse.json().resultCard).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats gateway interrupted status as terminal', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const fakeGateway = createFakeGatewayFactory();
    const app = buildApp({ config, gatewayFactory: fakeGateway.factory });
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/calls',
      payload: {
        phoneNumber: '+79990000000',
        questId: 'custom',
        voice: 'Bik-Freespeech_8000',
        customPrompt: 'Проведи короткий демо-разговор'
      }
    });
    const { sessionId } = createResponse.json();

    fakeGateway.options.onMessage({
      type: 'status',
      status: 'interrupted',
      requestId: 'request-1',
      callId: 'call-1',
      data: {}
    });

    await vi.waitFor(async () => {
      const sessionResponse = await app.inject({
        method: 'GET',
        url: `/api/calls/${sessionId}`
      });
      const session = sessionResponse.json();

      expect(session.status).toBe('interrupted');
      expect(session.resultCard).toMatchObject({
        questId: 'custom',
        source: 'fallback'
      });
    });

    const interruptResponse = await app.inject({
      method: 'POST',
      url: `/api/calls/${sessionId}/interrupt`
    });

    await app.close();

    expect(fakeGateway.gateway.close).toHaveBeenCalledOnce();
    expect(interruptResponse.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
