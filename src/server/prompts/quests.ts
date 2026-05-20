import type { QuestDefinition } from '../../shared/types';

export const FREESPEECH_VOICES = [
  'Bik-Freespeech_8000',
  'Che-Freespeech_8000',
  'Erm-Freespeech_8000',
  'She-Freespeech_8000',
  'Ved-Freespeech_8000'
] as const;

export type FreespeechVoice = (typeof FREESPEECH_VOICES)[number];

export const QUESTS = Object.freeze([
  Object.freeze({
    id: 'it-archetype',
    title: 'Айтишный Архетип',
    description: 'Веселое интервью, которое превращает участника в инженерный архетип.',
    accentColor: '#7cf7c7'
  }),
  Object.freeze({
    id: 'debugging-confession',
    title: 'Исповедь Отладчика',
    description: 'История странного бага превращается в мини-postmortem.',
    accentColor: '#ffd166'
  }),
  Object.freeze({
    id: 'prod-down-rpg',
    title: 'Мини-RPG: Прод Упал',
    description: 'Голосовой incident-квест, где участник спасает production.',
    accentColor: '#ff8bd1'
  }),
  Object.freeze({
    id: 'custom',
    title: 'Свободный промпт',
    description: 'Свой безопасный сценарий для демо-звонка.',
    accentColor: '#9bdcff'
  })
] satisfies QuestDefinition[]);

export function isAllowedVoice(voice: string): voice is FreespeechVoice {
  return FREESPEECH_VOICES.includes(voice as FreespeechVoice);
}
