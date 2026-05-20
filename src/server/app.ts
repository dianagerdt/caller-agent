import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { AppConfig } from './config';
import { loadConfig } from './config';
import { registerCallRoutes, type GatewayFactory } from './routes/calls';
import { registerQuestRoutes } from './routes/quests';
import { SessionStore } from './sessions/sessionStore';

interface BuildAppInput {
  config?: AppConfig;
  sessions?: SessionStore;
  gatewayFactory?: GatewayFactory;
}

export function buildApp(input: BuildAppInput = {}) {
  const app = Fastify({ logger: process.env.NODE_ENV === 'test' || process.env.VITEST ? false : true });
  const config = input.config ?? loadConfig();
  const sessions = input.sessions ?? new SessionStore();
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const staticRoot = path.resolve(dirname, '../../dist/client');

  app.register(registerQuestRoutes);
  app.register(registerCallRoutes, {
    config,
    sessions,
    gatewayFactory: input.gatewayFactory
  });

  if (fs.existsSync(staticRoot)) {
    app.register(fastifyStatic, {
      root: staticRoot,
      prefix: '/'
    });
  }

  return app;
}
