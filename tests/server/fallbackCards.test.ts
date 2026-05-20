import { describe, expect, it } from 'vitest';
import { buildFallbackCard } from '../../src/server/result-cards/fallback';

describe('fallback result cards', () => {
  it('builds an IT archetype fallback card from transcript', () => {
    const card = buildFallbackCard('it-archetype', [
      {
        id: '1',
        source: 'user',
        text: 'Я backend-разработчик, люблю чинить легаси',
        timestamp: 1
      }
    ]);

    expect(card.source).toBe('fallback');
    expect(card.title).toContain('Айтишный Архетип');
    expect(card.fields.archetype).toBeTruthy();
  });

  it('builds deterministic quest-specific cards', () => {
    const transcript = [
      {
        id: '1',
        source: 'user' as const,
        text: 'Прод упал после релиза, я проверил логи и откатил deploy',
        timestamp: 1
      }
    ];

    expect(buildFallbackCard('prod-down-rpg', transcript)).toEqual(buildFallbackCard('prod-down-rpg', transcript));
    expect(buildFallbackCard('debugging-confession', transcript).fields).toHaveProperty('rootCause');
    expect(buildFallbackCard('custom', transcript).fields).toHaveProperty('summary');
  });
});
