import 'dotenv/config';

export interface AppConfig {
  port: number;
  gigacallerGatewayWsUrl: string;
  gigacallerGatewayTlsRejectUnauthorized: boolean;
  gigacallerGatewayAuth?: {
    username: string;
    password: string;
  };
  defaultRetry: string;
  defaultVoice: string;
  gigachat: {
    apiKey?: string;
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

function parseBoolean(value: string | undefined, fallback: boolean, envName: string): boolean {
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

  throw new Error(`${envName} must be true or false`);
}

function parseGatewayAuth(env: NodeJS.ProcessEnv): AppConfig['gigacallerGatewayAuth'] {
  const username = optionalTrimmedValue(env.GIGACALLER_GATEWAY_USERNAME);
  const password = optionalTrimmedValue(env.GIGACALLER_GATEWAY_PASSWORD);
  if (!username && !password) {
    return undefined;
  }

  if (!username || !password) {
    throw new Error('GIGACALLER_GATEWAY_USERNAME and GIGACALLER_GATEWAY_PASSWORD must be set together');
  }

  return { username, password };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const gatewayUrl = env.GIGACALLER_GATEWAY_WS_URL?.trim();
  if (!gatewayUrl) {
    throw new Error('GIGACALLER_GATEWAY_WS_URL is required');
  }

  return {
    port: parsePort(env.PORT),
    gigacallerGatewayWsUrl: parseGatewayUrl(gatewayUrl),
    gigacallerGatewayTlsRejectUnauthorized: parseBoolean(
      env.GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED,
      true,
      'GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED'
    ),
    gigacallerGatewayAuth: parseGatewayAuth(env),
    defaultRetry: env.DEFAULT_RETRY ?? '0',
    defaultVoice: env.DEFAULT_VOICE ?? 'Bik-Freespeech_8000',
    gigachat: {
      apiKey: optionalTrimmedValue(env.GIGACHAT_API_KEY),
      scope: optionalTrimmedValue(env.GIGACHAT_SCOPE) ?? 'GIGACHAT_API_PERS',
      tlsRejectUnauthorized: parseBoolean(env.GIGACHAT_TLS_REJECT_UNAUTHORIZED, true, 'GIGACHAT_TLS_REJECT_UNAUTHORIZED'),
      authUrl: optionalValue(env.GIGACHAT_AUTH_URL, 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'),
      apiBaseUrl: optionalValue(env.GIGACHAT_API_BASE_URL, 'https://gigachat.devices.sberbank.ru/api/v1'),
      model: optionalValue(env.GIGACHAT_MODEL, 'GigaChat')
    }
  };
}
