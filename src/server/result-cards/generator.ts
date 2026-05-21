import type { AppConfig } from '../config';
import { GigaChatClient } from '../gigachat/client';
import { buildFallbackCard } from './fallback';
import { QUESTS } from '../prompts/quests';
import type { QuestId, ResultCard, TranscriptItem } from '../../shared/types';

export interface GenerateResultCardInput {
  questId: QuestId;
  transcript: TranscriptItem[];
  gigachat: AppConfig['gigachat'];
}

interface GigaChatCardPayload {
  title?: unknown;
  fields?: unknown;
}

export async function generateResultCard(input: GenerateResultCardInput): Promise<ResultCard> {
  const client = new GigaChatClient(input.gigachat);
  if (!client.isConfigured()) {
    return buildGeneratorFallbackCard(input.questId, input.transcript);
  }

  try {
    const payload = await client.completeJson(buildCardPrompt(input.questId, input.transcript));
    return normalizeResultCard(input.questId, payload);
  } catch {
    return buildGeneratorFallbackCard(input.questId, input.transcript);
  }
}

export function buildCardPrompt(questId: QuestId, transcript: TranscriptItem[]): string {
  const questTitle = getQuestTitle(questId);
  const lines = transcript
    .slice()
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((item) => `${item.source}: ${item.text.trim()}`)
    .filter((line) => !line.endsWith(':'))
    .join('\n');

  return [
    'Сформируй итоговую карточку голосового квеста.',
    'Отвечай только валидным JSON на русском языке, без Markdown и пояснений.',
    'Формат: {"title":"Короткий заголовок","fields":{"summary":"...","score":80,"tags":["..."]}}.',
    'Значения fields должны быть строками, числами или массивами коротких строк.',
    `Квест: ${questTitle} (${questId}).`,
    'Транскрипция:',
    lines || 'Нет реплик.'
  ].join('\n');
}

function normalizeResultCard(questId: QuestId, payload: unknown): ResultCard {
  const card = isRecord(payload) ? payload as GigaChatCardPayload : {};
  const fallbackTitle = getQuestTitle(questId);
  const title = typeof card.title === 'string' && card.title.trim() ? card.title.trim() : fallbackTitle;
  const fields = normalizeFields(card.fields);

  return {
    questId,
    source: 'gigachat',
    title,
    fields: Object.keys(fields).length > 0 ? fields : { summary: 'GigaChat вернул пустую карточку.' }
  };
}

function normalizeFields(fields: unknown): ResultCard['fields'] {
  if (!isRecord(fields)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, normalizeFieldValue(value)])
  );
}

function normalizeFieldValue(value: unknown): string | string[] | number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeScalarText(item));
  }

  return normalizeScalarText(value);
}

function normalizeScalarText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
    return value == null ? '' : String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildGeneratorFallbackCard(questId: QuestId, transcript: TranscriptItem[]): ResultCard {
  return {
    ...buildFallbackCard(questId, transcript),
    title: getQuestTitle(questId)
  };
}

function getQuestTitle(questId: QuestId): string {
  const title = QUESTS.find((quest) => quest.id === questId)?.title ?? 'Голосовой квест';
  if (questId === 'custom') {
    return 'Свободный Промпт';
  }

  return title;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
