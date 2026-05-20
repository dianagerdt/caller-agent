import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { loadConfig } from '../../src/server/config';

describe('server routes', () => {
  const config = loadConfig({
    GIGACALLER_GATEWAY_WS_URL: 'ws://localhost:9999'
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
});
