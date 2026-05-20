import type { QuestId, ResultCard, TranscriptItem } from '../../shared/types';
import { QUESTS } from '../prompts/quests';

const EMPTY_SUMMARY = 'Участник почти ничего не рассказал, поэтому карточка собрана по базовому сценарию.';
const MAX_SUMMARY_LENGTH = 220;

export function transcriptSummary(transcript: TranscriptItem[]): string {
  const userText = transcript
    .filter((item) => item.source === 'user')
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(' ');

  if (!userText) {
    return EMPTY_SUMMARY;
  }

  if (userText.length <= MAX_SUMMARY_LENGTH) {
    return userText;
  }

  return `${userText.slice(0, MAX_SUMMARY_LENGTH - 1).trimEnd()}...`;
}

export function buildFallbackCard(questId: QuestId, transcript: TranscriptItem[]): ResultCard {
  const questTitle = QUESTS.find((quest) => quest.id === questId)?.title ?? 'Голосовой квест';
  const summary = transcriptSummary(transcript);
  const normalizedSummary = summary.toLowerCase();

  switch (questId) {
    case 'it-archetype':
      return {
        questId,
        source: 'fallback',
        title: `${questTitle}: fallback-итог`,
        fields: {
          archetype: inferArchetype(normalizedSummary),
          strength: inferStrength(normalizedSummary),
          riskyZone: inferRiskyZone(normalizedSummary),
          badge: inferBadge(normalizedSummary),
          summary
        }
      };
    case 'debugging-confession':
      return {
        questId,
        source: 'fallback',
        title: `${questTitle}: fallback-postmortem`,
        fields: {
          incidentName: inferIncidentName(normalizedSummary),
          rootCause: inferRootCause(normalizedSummary),
          impact: inferImpact(normalizedSummary),
          fix: inferFix(normalizedSummary),
          lesson: 'Фиксируй наблюдения, проверяй гипотезы по одной и оставляй след в postmortem.',
          summary
        }
      };
    case 'prod-down-rpg':
      return {
        questId,
        source: 'fallback',
        title: `${questTitle}: fallback-verdict`,
        fields: {
          outcome: inferProdOutcome(normalizedSummary),
          actions: inferProdActions(normalizedSummary),
          survivalScore: inferSurvivalScore(normalizedSummary),
          verdict: inferProdVerdict(normalizedSummary),
          summary
        }
      };
    case 'custom':
      return {
        questId,
        source: 'fallback',
        title: `${questTitle}: fallback-итог`,
        fields: {
          summary,
          outcome: 'Разговор завершен, итог собран из доступной транскрипции.',
          nextStep: 'Показать участнику краткий результат и при необходимости запустить новый сценарий.'
        }
      };
  }
}

function inferArchetype(text: string): string {
  if (hasAny(text, ['legacy', 'легаси', 'монолит'])) {
    return 'Заклинатель легаси';
  }
  if (hasAny(text, ['frontend', 'фронтенд', 'css', 'пиксел'])) {
    return 'Пиксельный перфекционист';
  }
  if (hasAny(text, ['devops', 'sre', 'kubernetes', 'yaml', 'инцидент', 'прод'])) {
    return 'Инцидент-командир пятничного релиза';
  }
  if (hasAny(text, ['qa', 'тест', 'flaky'])) {
    return 'Повелитель flaky-тестов';
  }

  return 'Терапевт распределенных систем';
}

function inferStrength(text: string): string {
  if (hasAny(text, ['чинить', 'фикс', 'почин', 'debug', 'отлад'])) {
    return 'Быстро превращает хаос в проверяемые гипотезы.';
  }

  return 'Умеет спокойно разбирать техническую неопределенность.';
}

function inferRiskyZone(text: string): string {
  if (hasAny(text, ['легаси', 'legacy'])) {
    return 'Может слишком долго разговаривать с древним кодом.';
  }

  return 'Может уйти в оптимизацию раньше, чем понятна проблема.';
}

function inferBadge(text: string): string {
  if (hasAny(text, ['backend', 'бэкенд'])) {
    return 'Backend Whisperer';
  }
  if (hasAny(text, ['frontend', 'фронтенд'])) {
    return 'Pixel Guardian';
  }
  if (hasAny(text, ['devops', 'sre', 'прод'])) {
    return 'On-call Hero';
  }

  return 'Production Survivor';
}

function inferIncidentName(text: string): string {
  if (hasAny(text, ['пятниц', 'friday'])) {
    return 'Пятничный сюрприз';
  }
  if (hasAny(text, ['кэш', 'cache'])) {
    return 'Кэш, который все помнил';
  }

  return 'Баг с человеческим лицом';
}

function inferRootCause(text: string): string {
  if (hasAny(text, ['конфиг', 'config', 'yaml'])) {
    return 'Похоже на проблему конфигурации.';
  }
  if (hasAny(text, ['релиз', 'deploy', 'деплой'])) {
    return 'Похоже на регрессию после релиза.';
  }

  return 'Причина не названа явно, нужна проверка логов и последних изменений.';
}

function inferImpact(text: string): string {
  if (hasAny(text, ['пользовател', 'sla', 'деньг', '500', 'прод'])) {
    return 'Был заметный пользовательский или production-impact.';
  }

  return 'Impact по транскрипции неясен.';
}

function inferFix(text: string): string {
  if (hasAny(text, ['откат', 'rollback'])) {
    return 'Откатить проблемное изменение и проверить метрики.';
  }
  if (hasAny(text, ['фикс', 'почин', 'patch'])) {
    return 'Внести точечный фикс и закрепить проверкой.';
  }

  return 'Сузить гипотезы, найти причину и зафиксировать урок.';
}

function inferProdOutcome(text: string): string {
  if (hasAny(text, ['откат', 'rollback', 'почин', 'исправ'])) {
    return 'Прод стабилизирован после осознанного действия.';
  }

  return 'Прод выжил в демо-режиме, но просит больше наблюдаемости.';
}

function inferProdActions(text: string): string[] {
  const actions: string[] = [];
  if (hasAny(text, ['лог', 'logs'])) {
    actions.push('проверил логи');
  }
  if (hasAny(text, ['откат', 'rollback'])) {
    actions.push('откатил релиз');
  }
  if (hasAny(text, ['баз', 'database', 'db'])) {
    actions.push('проверил базу');
  }
  if (hasAny(text, ['чат', 'канал', 'incident'])) {
    actions.push('собрал incident-канал');
  }

  return actions.length > 0 ? actions : ['сохранил спокойствие'];
}

function inferSurvivalScore(text: string): number {
  if (hasAny(text, ['откат', 'rollback', 'почин', 'исправ'])) {
    return 88;
  }
  if (hasAny(text, ['лог', 'метрик', 'monitor'])) {
    return 72;
  }

  return 60;
}

function inferProdVerdict(text: string): string {
  if (hasAny(text, ['откат', 'rollback'])) {
    return 'Откатный магистр';
  }
  if (hasAny(text, ['лог', 'метрик'])) {
    return 'Наблюдательный дежурный';
  }

  return 'Дежурный без паники';
}

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}
