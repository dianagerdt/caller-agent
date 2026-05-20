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
