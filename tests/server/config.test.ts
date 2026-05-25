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
    expect(config.gigachat.scope).toBeUndefined();
  });

  it('rejects missing gateway URL', () => {
    expect(() => loadConfig({})).toThrow('GIGACALLER_GATEWAY_WS_URL is required');
  });

  it('rejects invalid port values', () => {
    const invalidPorts = ['0', '65536', '3.14', 'not-a-number', 'Infinity'];

    for (const port of invalidPorts) {
      expect(() =>
        loadConfig({
          GIGACALLER_GATEWAY_WS_URL: 'ws://gateway:8080',
          PORT: port
        })
      ).toThrow('PORT must be an integer from 1 to 65535');
    }
  });

  it('rejects gateway URLs without ws or wss protocol', () => {
    const invalidUrls = [
      'http://gateway',
      'not a url',
      'ws:gateway',
      'ws:/gateway',
      'wss:gateway',
      'ws:///gateway',
      'wss:///gateway',
      'ws:////gateway',
      'ws://gateway#frag'
    ];

    for (const gatewayUrl of invalidUrls) {
      expect(() =>
        loadConfig({
          GIGACALLER_GATEWAY_WS_URL: gatewayUrl
        })
      ).toThrow('GIGACALLER_GATEWAY_WS_URL must be a ws:// or wss:// URL');
    }
  });

  it('uses GigaChat defaults for blank optional values', () => {
    const config = loadConfig({
      GIGACALLER_GATEWAY_WS_URL: 'wss://gateway:8080/',
      GIGACHAT_SCOPE: '   ',
      GIGACHAT_AUTH_URL: '',
      GIGACHAT_API_BASE_URL: '  ',
      GIGACHAT_MODEL: ''
    });

    expect(config.gigacallerGatewayWsUrl).toBe('wss://gateway:8080');
    expect(config.gigachat.scope).toBeUndefined();
    expect(config.gigachat.authUrl).toBe('https://mock-gigachat-auth.example.test/api/v2/oauth');
    expect(config.gigachat.apiBaseUrl).toBe('https://mock-gigachat-api.example.test/api/v1');
    expect(config.gigachat.model).toBe('GigaChat');
  });

  it('supports direct GigaChat token and login-password auth settings', () => {
    const config = loadConfig({
      GIGACALLER_GATEWAY_WS_URL: 'ws://gateway:8080',
      GIGACHAT_ACCESS_TOKEN: ' direct-token ',
      GIGACHAT_USERNAME: ' user ',
      GIGACHAT_PASSWORD: ' pass ',
      GIGACHAT_SCOPE: ' GIGACHAT_API_CORP '
    });

    expect(config.gigachat.accessToken).toBe('direct-token');
    expect(config.gigachat.username).toBe('user');
    expect(config.gigachat.password).toBe('pass');
    expect(config.gigachat.scope).toBe('GIGACHAT_API_CORP');
  });

  it('allows disabling GigaChat TLS verification for local demos', () => {
    const config = loadConfig({
      GIGACALLER_GATEWAY_WS_URL: 'ws://gateway:8080',
      GIGACHAT_TLS_REJECT_UNAUTHORIZED: 'false'
    });

    expect(config.gigachat.tlsRejectUnauthorized).toBe(false);
  });

  it('allows disabling GigaCaller Gateway TLS verification for local demos', () => {
    const config = loadConfig({
      GIGACALLER_GATEWAY_WS_URL: 'wss://gateway:443',
      GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED: 'false'
    });

    expect(config.gigacallerGatewayTlsRejectUnauthorized).toBe(false);
  });
});
