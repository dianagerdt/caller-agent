import type { FastifyPluginAsync } from 'fastify';
import { FREESPEECH_VOICES, getQuestDefinitions } from '../prompts/promptBuilder';

export const registerQuestRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/quests', async () => ({
    quests: getQuestDefinitions(),
    voices: FREESPEECH_VOICES
  }));
};
