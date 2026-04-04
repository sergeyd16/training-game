import { getRecord, putRecord } from './storage.js';

export function calcLevel(lifetimePoints) {
  return Math.floor(lifetimePoints / 10) + 1;
}

export async function initHero() {
  const existing = await getRecord('hero', 'hero');
  if (!existing) {
    const defaultHero = {
      id: 'hero',
      name: 'Hero',
      avatar: '🦸',
      level: 1,
      currentPoints: 0,
      lifetimePoints: 0,
      streak: 0,
      crystals: 0,
      lastCompletedDate: null,
    };
    await putRecord('hero', defaultHero);
    return defaultHero;
  }
  return existing;
}

export async function getHero() {
  return getRecord('hero', 'hero');
}

export async function updateHero(fields) {
  const hero = await getHero();
  const updated = { ...hero, ...fields };
  await putRecord('hero', updated);
  return updated;
}
