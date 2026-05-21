import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateResultCard } from '../../src/server/result-cards/generator';

const baseGigachat = {
  scope: 'GIGACHAT_API_PERS',
  authUrl: '',
  apiBaseUrl: '',
  model: 'GigaChat'
};

describe('generateResultCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses fallback when credentials are absent', async () => {
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
      gigachat: { ...baseGigachat, credentials: 'basic-token', authUrl: 'https://auth.local', apiBaseUrl: 'https://api.local' }
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
      gigachat: { ...baseGigachat, credentials: 'basic-token', authUrl: 'https://auth.local', apiBaseUrl: 'https://api.local' }
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
  });
});
