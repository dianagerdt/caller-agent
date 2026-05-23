import 'dotenv/config';

export interface AppConfig {
  port: number;
  gigacallerGatewayWsUrl: string;
  gigacallerGatewayTlsRejectUnauthorized: boolean;
  defaultRetry: string;
  defaultVoice: string;
  gigachat: {
    accessToken?: string;
    credentials?: string;
    username?: string;
    password?: string;
    scope?: string;
    tlsRejectUnauthorized: boolean;
    authUrl: string;
    apiBaseUrl: string;
    model: string;
  };
}

function optionalTrimmedValue(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function optionalValue(value: string | undefined, fallback: string): string {
  return optionalTrimmedValue(value) || fallback;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }

  return port;
}

function parseGatewayUrl(value: string): string {
  if (!/^wss?:\/\/[^/\s]+/.test(value)) {
    throw new Error('GIGACALLER_GATEWAY_WS_URL must be a ws:// or wss:// URL');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('GIGACALLER_GATEWAY_WS_URL must be a ws:// or wss:// URL');
  }

  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('GIGACALLER_GATEWAY_WS_URL must be a ws:// or wss:// URL');
  }

  if (url.hash) {
    throw new Error('GIGACALLER_GATEWAY_WS_URL must be a ws:// or wss:// URL');
  }

  return value.replace(/\/$/, '');
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  throw new Error('GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED must be true or false');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const gatewayUrl = env.GIGACALLER_GATEWAY_WS_URL?.trim();
  if (!gatewayUrl) {
    throw new Error('GIGACALLER_GATEWAY_WS_URL is required');
  }

  return {
    port: parsePort(env.PORT),
    gigacallerGatewayWsUrl: parseGatewayUrl(gatewayUrl),
    gigacallerGatewayTlsRejectUnauthorized: parseBoolean(env.GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED, true),
    defaultRetry: env.DEFAULT_RETRY ?? '0',
    defaultVoice: env.DEFAULT_VOICE ?? 'Bik-Freespeech_8000',
    gigachat: {
      accessToken: optionalTrimmedValue(env.GIGACHAT_ACCESS_TOKEN),
      credentials: optionalTrimmedValue(env.GIGACHAT_CREDENTIALS),
      username: optionalTrimmedValue(env.GIGACHAT_USERNAME),
      password: optionalTrimmedValue(env.GIGACHAT_PASSWORD),
      scope: optionalTrimmedValue(env.GIGACHAT_SCOPE),
      tlsRejectUnauthorized: parseBoolean(env.GIGACHAT_TLS_REJECT_UNAUTHORIZED, true),
      authUrl: optionalValue(env.GIGACHAT_AUTH_URL, 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'),
      apiBaseUrl: optionalValue(env.GIGACHAT_API_BASE_URL, 'https://gigachat.devices.sberbank.ru/api/v1'),
      model: optionalValue(env.GIGACHAT_MODEL, 'GigaChat')
    }
  };
}
