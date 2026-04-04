import { putRecord, getAllRecords } from './storage.js';
import { getHero, updateHero } from './hero.js';
import { todayStr } from './daily-log.js';

export async function convertPoints() {
  const hero = await getHero();
  if (!hero.currentPoints || hero.currentPoints === 0) {
    throw new Error('No points to convert');
  }

  const record = {
    date: todayStr(),
    pointsConverted: hero.currentPoints,
    crystalEarned: 1,
  };
  await putRecord('rewardHistory', record);

  const updated = await updateHero({
    crystals: (hero.crystals || 0) + 1,
    currentPoints: 0,
  });

  return updated;
}

export async function getRewardHistory() {
  const records = await getAllRecords('rewardHistory');
  return records.sort((a, b) => (a.date < b.date ? 1 : -1));
}
