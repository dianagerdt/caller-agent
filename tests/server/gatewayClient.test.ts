import { describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { GatewayClient, normalizeGatewayTextMessage } from '../../src/server/gigacaller/gatewayClient';

describe('normalizeGatewayTextMessage', () => {
  it('normalizes ready messages', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'ready',
      data: { requestId: 'req-1' }
    }))).toEqual({ type: 'ready', requestId: 'req-1' });
  });

  it('normalizes transcription source and text', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'transcription',
      data: { source: 'USER', text: 'Привет', seqNum: 2 }
    }))).toEqual({ type: 'transcription', source: 'user', text: 'Привет', seqNum: 2, callId: undefined });
  });

  it('normalizes numeric transcription source values', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'transcription',
      data: { source: 1, text: 'Здравствуйте' }
    }))).toEqual({ type: 'transcription', source: 'model', text: 'Здравствуйте', seqNum: undefined, callId: undefined });
  });

  it('normalizes status messages', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'status',
      data: { status: 'connected', requestId: 'req-1', callId: 'call-1', retry: 2 }
    }))).toEqual({
      type: 'status',
      status: 'connected',
      requestId: 'req-1',
      callId: 'call-1',
      data: { status: 'connected', requestId: 'req-1', callId: 'call-1', retry: 2 }
    });
  });

  it('preserves raw function call data', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'functionCall',
      data: { name: 'selectQuest', arguments: { id: 'quest-1' }, callId: 'call-1' }
    }))).toEqual({
      type: 'functionCall',
      data: { name: 'selectQuest', arguments: { id: 'quest-1' }, callId: 'call-1' }
    });
  });

  it('normalizes error messages', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'error',
      data: { message: 'Gateway failed', code: 'BAD_REQUEST' }
    }))).toEqual({ type: 'error', message: 'Gateway failed', data: { message: 'Gateway failed', code: 'BAD_REQUEST' } });
  });

  it('defaults gateway error message and retains data', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'error',
      data: { code: 'UPSTREAM_ERROR' }
    }))).toEqual({ type: 'error', message: 'Gateway error', data: { code: 'UPSTREAM_ERROR' } });
  });

  it('normalizes unknown message types', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'custom',
      data: { value: true }
    }))).toEqual({ type: 'unknown', rawType: 'custom', data: { value: true } });
  });

  it('throws on invalid JSON', () => {
    expect(() => normalizeGatewayTextMessage('{bad')).toThrow('Invalid gateway JSON');
  });
});

describe('GatewayClient', () => {
  it('sends interrupt payload with fixed calledAt timestamp', () => {
    const send = vi.fn();
    const client = new GatewayClient({
      baseUrl: 'ws://gateway.local',
      onMessage: vi.fn(),
      onBinary: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn()
    });

    Object.assign(client as unknown as { socket: { readyState: number; send: (data: string) => void } }, {
      socket: { readyState: WebSocket.OPEN, send }
    });

    client.interrupt(1234567890);

    expect(send).toHaveBeenCalledWith(JSON.stringify({
      type: 'interrupt',
      data: { calledAt: 1234567890 }
    }));
  });
});
