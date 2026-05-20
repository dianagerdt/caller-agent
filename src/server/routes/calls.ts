import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../config';
import { GatewayClient, type GatewayClientOptions } from '../gigacaller/gatewayClient';
import { buildSystemPrompt } from '../prompts/promptBuilder';
import { isAllowedVoice } from '../prompts/quests';
import type { SessionStore } from '../sessions/sessionStore';
import type { CallStatus } from '../../shared/types';

export type GatewayConnection = Pick<GatewayClient, 'connect' | 'sendInitialRequest' | 'interrupt' | 'close'>;
export type GatewayFactory = (options: GatewayClientOptions) => GatewayConnection;

export interface RegisterCallRoutesDeps {
  config: AppConfig;
  sessions: SessionStore;
  gatewayFactory?: GatewayFactory;
}

const startCallSchema = z.object({
  phoneNumber: z.string().min(5),
  questId: z.enum(['it-archetype', 'debugging-confession', 'prod-down-rpg', 'custom']),
  voice: z.string(),
  customPrompt: z.string().optional().nullable()
});

const terminalStatuses = new Set<CallStatus>(['completed', 'noAnswer', 'failed']);

export const registerCallRoutes: FastifyPluginAsync<RegisterCallRoutesDeps> = async (app, deps) => {
  const gateways = new Map<string, GatewayConnection>();
  const gatewayFactory = deps.gatewayFactory ?? ((options: GatewayClientOptions) => new GatewayClient(options));

  app.post('/api/calls', async (request, reply) => {
    const parsed = startCallSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid call request', issues: parsed.error.issues });
    }

    if (!isAllowedVoice(parsed.data.voice)) {
      return reply.code(400).send({ message: `Unsupported voice: ${parsed.data.voice}` });
    }

    const phoneNumber = cleanPhoneNumber(parsed.data.phoneNumber);
    if (!isValidPhoneNumber(phoneNumber)) {
      return reply.code(400).send({ message: 'Invalid phone number' });
    }

    const session = deps.sessions.create({
      questId: parsed.data.questId,
      voice: parsed.data.voice
    });
    const systemPrompt = buildSystemPrompt(parsed.data);
    let gateway: GatewayConnection;

    gateway = gatewayFactory({
      baseUrl: deps.config.gigacallerGatewayWsUrl,
      onBinary: () => {
        deps.sessions.addTechnicalEvent(session.sessionId, {
          level: 'info',
          message: 'Ignored binary audio chunk'
        });
      },
      onClose: (code, reason) => {
        gateways.delete(session.sessionId);
        deps.sessions.addTechnicalEvent(session.sessionId, {
          level: 'warning',
          message: 'Gateway WebSocket closed',
          details: { code, reason: reason.toString() }
        });

        const snapshot = deps.sessions.get(session.sessionId);
        if (snapshot && !terminalStatuses.has(snapshot.status)) {
          deps.sessions.setStatus(session.sessionId, 'closed');
        }
      },
      onError: (error) => {
        deps.sessions.addTechnicalEvent(session.sessionId, {
          level: 'error',
          message: error.message
        });
      },
      onMessage: (message) => {
        switch (message.type) {
          case 'ready':
            if (message.requestId) {
              deps.sessions.setRequestId(session.sessionId, message.requestId);
            }
            gateway.sendInitialRequest({
              phoneNumber,
              systemPrompt,
              retry: deps.config.defaultRetry,
              voice: parsed.data.voice
            });
            deps.sessions.setStatus(session.sessionId, 'published');
            break;
          case 'status':
            if (message.requestId) {
              deps.sessions.setRequestId(session.sessionId, message.requestId);
            }
            if (message.callId) {
              deps.sessions.setCallId(session.sessionId, message.callId);
            }
            deps.sessions.setStatus(session.sessionId, normalizeStatus(message.status));
            break;
          case 'transcription':
            if (message.callId) {
              deps.sessions.setCallId(session.sessionId, message.callId);
            }
            deps.sessions.addTranscript(session.sessionId, {
              source: message.source,
              text: message.text,
              seqNum: message.seqNum
            });
            break;
          case 'functionCall':
            deps.sessions.addTechnicalEvent(session.sessionId, {
              level: 'info',
              message: 'Function call received',
              details: message.data
            });
            break;
          case 'error':
            deps.sessions.addTechnicalEvent(session.sessionId, {
              level: 'error',
              message: message.message,
              details: message.data
            });
            deps.sessions.setStatus(session.sessionId, 'failed');
            break;
          case 'unknown':
            deps.sessions.addTechnicalEvent(session.sessionId, {
              level: 'warning',
              message: 'Unknown gateway message',
              details: message.data
            });
            break;
        }
      }
    });

    gateways.set(session.sessionId, gateway);
    gateway.connect();

    return reply.code(202).send(deps.sessions.get(session.sessionId));
  });

  app.get('/api/calls/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = deps.sessions.get(sessionId);
    if (!session) {
      return reply.code(404).send({ message: 'Session not found' });
    }

    return session;
  });

  app.get('/api/calls/:sessionId/events', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    if (!deps.sessions.get(sessionId)) {
      return reply.code(404).send({ message: 'Session not found' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    const unsubscribe = deps.sessions.subscribe(sessionId, (event) => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    request.raw.on('close', unsubscribe);
  });

  app.post('/api/calls/:sessionId/interrupt', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const session = deps.sessions.get(sessionId);
    const gateway = gateways.get(sessionId);
    if (!session || !gateway) {
      return reply.code(404).send({ message: 'Session not found' });
    }

    gateway.interrupt();
    deps.sessions.setStatus(sessionId, 'interrupted');

    return { ok: true };
  });
};

function cleanPhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

function isValidPhoneNumber(phoneNumber: string): boolean {
  return /^\d{10,15}$/.test(phoneNumber);
}

function normalizeStatus(status: string | undefined): CallStatus {
  if (status === 'ringing' || status === 'answered' || status === 'completed' || status === 'noAnswer' || status === 'failed') {
    return status;
  }

  return 'published';
}
