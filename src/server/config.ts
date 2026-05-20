import 'dotenv/config';

export interface AppConfig {
  port: number;
  gigacallerGatewayWsUrl: string;
  defaultRetry: string;
  defaultVoice: string;
  gigachat: {
    credentials?: string;
    scope: string;
    authUrl: string;
    apiBaseUrl: string;
    model: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const gatewayUrl = env.GIGACALLER_GATEWAY_WS_URL?.trim();
  if (!gatewayUrl) {
    throw new Error('GIGACALLER_GATEWAY_WS_URL is required');
  }

  return {
    port: Number(env.PORT ?? 3000),
    gigacallerGatewayWsUrl: gatewayUrl.replace(/\/$/, ''),
    defaultRetry: env.DEFAULT_RETRY ?? '0',
    defaultVoice: env.DEFAULT_VOICE ?? 'Bik-Freespeech_8000',
    gigachat: {
      credentials: env.GIGACHAT_CREDENTIALS?.trim() || undefined,
      scope: env.GIGACHAT_SCOPE ?? 'GIGACHAT_API_PERS',
      authUrl: env.GIGACHAT_AUTH_URL ?? 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
      apiBaseUrl: env.GIGACHAT_API_BASE_URL ?? 'https://gigachat.devices.sberbank.ru/api/v1',
      model: env.GIGACHAT_MODEL ?? 'GigaChat'
    }
  };
}
