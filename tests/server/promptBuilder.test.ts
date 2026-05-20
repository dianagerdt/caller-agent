import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, FREESPEECH_VOICES, getQuestDefinitions } from '../../src/server/prompts/promptBuilder';

describe('prompt builder', () => {
  it('returns the freespeech voice allowlist', () => {
    expect(FREESPEECH_VOICES).toEqual([
      'Bik-Freespeech_8000',
      'Che-Freespeech_8000',
      'Erm-Freespeech_8000',
      'She-Freespeech_8000',
      'Ved-Freespeech_8000'
    ]);
  });

  it('builds a detailed archetype prompt', () => {
    const prompt = buildSystemPrompt({ questId: 'it-archetype' });

    expect(prompt).toContain('Айтишный Архетип');
    expect(prompt).toContain('Заклинатель легаси');
    expect(prompt).toContain('end_call');
    expect(prompt).toContain('не запрашивай пароли');
  });

  it('wraps custom prompts with safety rules', () => {
    const prompt = buildSystemPrompt({
      questId: 'custom',
      customPrompt: 'Проведи собеседование на senior YAML engineer'
    });

    expect(prompt).toContain('Пользовательский сценарий');
    expect(prompt).toContain('senior YAML engineer');
    expect(prompt).toContain('не выдавай себя за банк');
    expect(prompt).toContain('end_call');
  });

  it('exposes three built-in quests plus custom mode', () => {
    expect(getQuestDefinitions().map((quest) => quest.id)).toEqual([
      'it-archetype',
      'debugging-confession',
      'prod-down-rpg',
      'custom'
    ]);
  });
});
