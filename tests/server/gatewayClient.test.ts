import { describe, expect, it } from 'vitest';
import { normalizeGatewayTextMessage } from '../../src/server/gigacaller/gatewayClient';

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
      data: { status: 'connected', callId: 'call-1' }
    }))).toEqual({ type: 'status', status: 'connected', callId: 'call-1' });
  });

  it('normalizes function call messages', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'functionCall',
      data: { name: 'selectQuest', arguments: { id: 'quest-1' }, callId: 'call-1' }
    }))).toEqual({ type: 'functionCall', name: 'selectQuest', arguments: { id: 'quest-1' }, callId: 'call-1' });
  });

  it('normalizes error messages', () => {
    expect(normalizeGatewayTextMessage(JSON.stringify({
      type: 'error',
      data: { message: 'Gateway failed', code: 'BAD_REQUEST' }
    }))).toEqual({ type: 'error', message: 'Gateway failed', code: 'BAD_REQUEST' });
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
