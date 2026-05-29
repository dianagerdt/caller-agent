import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateResultCard } from '../../src/server/result-cards/generator';

const baseGigachat = {
  authUrl: '',
  apiBaseUrl: '',
  model: 'GigaChat',
  tlsRejectUnauthorized: true
};

describe('generateResultCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses fallback when GigaChat API key is absent', async () => {
    const card = await generateResultCard({
      questId: 'custom',
      transcript: [{ id: '1', source: 'user', text: 'Привет', timestamp: 1 }],
      gigachat: baseGigachat
    });

    expect(card.source).toBe('fallback');
    expect(card.title).toBe('Свободный Промпт');
  });

  it('uses fallback when GigaChat request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const card = await generateResultCard({
      questId: 'it-archetype',
      transcript: [{ id: '1', source: 'user', text: 'Я люблю backend', timestamp: 1 }],
      gigachat: { ...baseGigachat, apiKey: 'authorization-key', authUrl: 'https://auth.local', apiBaseUrl: 'https://api.local' }
    });

    expect(card.source).toBe('fallback');
    expect(card.title).toContain('Айтишный Архетип');
  });

  it('normalizes fenced GigaChat JSON into a result card', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access-token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '```json\n{"title":"Итог","fields":{"score":95,"tags":["prod","debug"],"summary":"Готово","empty":null,"nested":{"skip":true}}}\n```'
            }
          }]
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    const card = await generateResultCard({
      questId: 'prod-down-rpg',
      transcript: [{ id: '1', source: 'user', text: 'Проверил логи и откатил релиз', timestamp: 1 }],
      gigachat: { ...baseGigachat, apiKey: 'authorization-key', authUrl: 'https://auth.local', apiBaseUrl: 'https://api.local' }
    });

    expect(card).toEqual({
      questId: 'prod-down-rpg',
      source: 'gigachat',
      title: 'Итог',
      fields: {
        score: 95,
        tags: ['prod', 'debug'],
        summary: 'Готово',
        empty: '',
        nested: '{"skip":true}'
      }
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      model: 'GigaChat',
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: expect.stringContaining('Проверил логи') })
      ]),
      temperature: 0.4
    });
  });

  it('uses GigaChat API key for OAuth Basic auth', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tok: 'oauth-token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"title":"Итог по API key","fields":{"summary":"Готово"}}'
            }
          }]
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    const card = await generateResultCard({
      questId: 'custom',
      transcript: [{ id: '1', source: 'user', text: 'Проверяем API key', timestamp: 1 }],
      gigachat: {
        ...baseGigachat,
        apiKey: 'authorization-key',
        authUrl: 'https://auth.local',
        apiBaseUrl: 'https://api.local'
      }
    });

    expect(card.source).toBe('gigachat');
    expect(fetchMock.mock.calls[0][0]).toBe('https://auth.local');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Basic authorization-key'
    });
    expect(fetchMock.mock.calls[0][1].body).toBe('');
  });

  it('passes a custom TLS dispatcher to GigaChat when verification is disabled', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access-token' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"title":"Итог","fields":{"summary":"Готово"}}'
            }
          }]
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    await generateResultCard({
      questId: 'custom',
      transcript: [{ id: '1', source: 'user', text: 'Проверяем TLS', timestamp: 1 }],
      gigachat: {
        ...baseGigachat,
        apiKey: 'authorization-key',
        apiBaseUrl: 'https://api.local',
        tlsRejectUnauthorized: false
      }
    });

    expect(fetchMock.mock.calls[0][1].dispatcher).toBeDefined();
    expect(fetchMock.mock.calls[1][1].dispatcher).toBeDefined();
  });

  it('reports fallback reasons to callers', async () => {
    const fallbackReasons: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('TLS failed')));

    await generateResultCard({
      questId: 'custom',
      transcript: [{ id: '1', source: 'user', text: 'Проверяем ошибку', timestamp: 1 }],
      gigachat: { ...baseGigachat, apiKey: 'authorization-key', apiBaseUrl: 'https://api.local' },
      onFallback: (reason) => fallbackReasons.push(reason)
    });

    expect(fallbackReasons).toEqual(['TLS failed']);
  });
});
