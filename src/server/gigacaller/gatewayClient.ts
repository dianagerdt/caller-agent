import WebSocket from 'ws';
import type { RawData } from 'ws';

export type GatewayTranscriptSource = 'user' | 'model' | 'unknown';

export type NormalizedGatewayMessage =
  | { type: 'ready'; requestId: string | undefined }
  | {
      type: 'status';
      status: string | undefined;
      requestId: string | undefined;
      callId: string | undefined;
      data: unknown;
    }
  | {
      type: 'transcription';
      source: GatewayTranscriptSource;
      text: string;
      seqNum: number | undefined;
      callId: string | undefined;
    }
  | { type: 'functionCall'; data: unknown }
  | { type: 'error'; message: string; data: unknown }
  | { type: 'unknown'; rawType: string | undefined; data: unknown };

export interface GatewayClientOptions {
  baseUrl: string;
  requestId?: string;
  tlsRejectUnauthorized?: boolean;
  auth?: {
    username: string;
    password: string;
  };
  onMessage: (message: NormalizedGatewayMessage) => void;
  onBinary: (data: Buffer) => void;
  onClose: (code: number, reason: Buffer) => void;
  onError: (error: Error) => void;
}

export class GatewayClient {
  private socket?: WebSocket;

  constructor(private readonly options: GatewayClientOptions) {}

  connect(): void {
    const socket = new WebSocket(
      buildGatewayWsUrl(this.options.baseUrl, this.options.requestId),
      buildGatewayClientOptions(this.options.auth, this.options.tlsRejectUnauthorized)
    );
    this.socket = socket;

    socket.on('message', (data, isBinary) => {
      try {
        if (isBinary) {
          this.options.onBinary(toBuffer(data));
          return;
        }

        this.options.onMessage(normalizeGatewayTextMessage(data.toString()));
      } catch (error) {
        this.options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    });

    socket.on('close', (code, reason) => {
      this.options.onClose(code, reason);
    });

    socket.on('error', (error) => {
      this.options.onError(error);
    });
  }

  sendInitialRequest(payload: unknown): void {
    this.sendJson({ type: 'initialRequest', data: payload });
  }

  interrupt(calledAt = Date.now()): void {
    this.sendJson({ type: 'interrupt', data: { calledAt } });
  }

  close(): void {
    this.socket?.close();
  }

  private sendJson(payload: unknown): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway socket is not open');
    }

    this.socket.send(JSON.stringify(payload));
  }
}

export function buildGatewayWsUrl(baseUrl: string, requestId: string | undefined): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const wsBaseUrl = normalizedBaseUrl.endsWith('/v1/ws') ? normalizedBaseUrl : `${normalizedBaseUrl}/v1/ws`;
  return `${wsBaseUrl}/${requestId ?? ''}`;
}

export function buildGatewayAuthorizationHeader(auth: GatewayClientOptions['auth']): string | undefined {
  if (!auth) {
    return undefined;
  }

  return `Basic ${Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64')}`;
}

export function buildGatewayClientOptions(
  auth: GatewayClientOptions['auth'],
  tlsRejectUnauthorized: boolean | undefined
): WebSocket.ClientOptions {
  const authorizationHeader = buildGatewayAuthorizationHeader(auth);
  const cookieJar = new Map<string, string>();
  return {
    rejectUnauthorized: tlsRejectUnauthorized,
    followRedirects: true,
    maxRedirects: 3,
    headers: authorizationHeader ? { Authorization: authorizationHeader } : undefined,
    finishRequest: (request) => {
      const cookieHeader = buildGatewayCookieHeader(cookieJar);
      if (cookieHeader) {
        request.setHeader('Cookie', cookieHeader);
      }

      request.on('response', (response) => {
        updateGatewayCookieJar(cookieJar, response.headers['set-cookie']);
      });
      request.end();
    }
  };
}

export function updateGatewayCookieJar(cookieJar: Map<string, string>, setCookie: string | string[] | undefined): void {
  const setCookieHeaders = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const header of setCookieHeaders) {
    const [cookiePair] = header.split(';', 1);
    const separatorIndex = cookiePair.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    cookieJar.set(cookiePair.slice(0, separatorIndex), cookiePair.slice(separatorIndex + 1));
  }
}

export function buildGatewayCookieHeader(cookieJar: Map<string, string>): string | undefined {
  if (cookieJar.size === 0) {
    return undefined;
  }

  return Array.from(cookieJar, ([name, value]) => `${name}=${value}`).join('; ');
}

export function normalizeGatewayTextMessage(text: string): NormalizedGatewayMessage {
  let parsed: GatewayEnvelope;
  try {
    parsed = JSON.parse(text) as GatewayEnvelope;
  } catch {
    throw new Error('Invalid gateway JSON');
  }

  const data = isRecord(parsed.data) ? parsed.data : {};

  switch (parsed.type) {
    case 'ready':
      return { type: 'ready', requestId: asString(data.requestId) };
    case 'status':
      return {
        type: 'status',
        status: asString(data.status),
        requestId: asString(data.requestId),
        callId: asString(data.callId),
        data: parsed.data
      };
    case 'transcription':
      return {
        type: 'transcription',
        source: normalizeSource(data.source),
        text: asString(data.text) ?? '',
        seqNum: asNumber(data.seqNum),
        callId: asString(data.callId)
      };
    case 'functionCall':
      return { type: 'functionCall', data: parsed.data };
    case 'error':
      return { type: 'error', message: asString(data.message) ?? 'Gateway error', data: parsed.data };
    default:
      return { type: 'unknown', rawType: asString(parsed.type), data: parsed.data };
  }
}

function normalizeSource(source: unknown): GatewayTranscriptSource {
  if (source === 2 || source === '2') {
    return 'user';
  }

  if (source === 1 || source === '1') {
    return 'model';
  }

  if (typeof source === 'string') {
    const normalized = source.toLowerCase();
    if (normalized === 'user') {
      return 'user';
    }

    if (normalized === 'model') {
      return 'model';
    }
  }

  return 'unknown';
}

interface GatewayEnvelope {
  type?: unknown;
  data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return Buffer.from(data);
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data.map((chunk) => Buffer.from(chunk)));
  }

  return Buffer.from(data);
}
