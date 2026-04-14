import { getRecord, putRecord, getAllRecords } from './storage.js';
import { getHero, updateHero, calcLevel } from './hero.js';
import { getProgram } from './programs.js';

function dateStrFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

async function recalculateAll() {
  const [allLogs, rewardHistory] = await Promise.all([
    getAllRecords('dayLogs'),
    getAllRecords('rewardHistory'),
  ]);

  // Work only with completed logs, oldest first
  const completedLogs = allLogs
    .filter((l) => l.completed)
    .sort((a, b) => a.date.localeCompare(b.date));

  const completedDateSet = new Set(completedLogs.map((l) => l.date));

  // Walk chronologically, correcting streakOnDay and pointsEarned
  for (const log of completedLogs) {
    const prev = new Date(log.date + 'T00:00:00');
    prev.setDate(prev.getDate() - 1);
    const prevDateStr = dateStrFromDate(prev);

    const prevLog = completedLogs.find((l) => l.date === prevDateStr);
    const correctStreakOnDay = prevLog ? (prevLog.streakOnDay || 0) + 1 : 1;
    const correctPointsEarned = 1 + (correctStreakOnDay % 5 === 0 ? 5 : 0);

    if (log.streakOnDay !== correctStreakOnDay || log.pointsEarned !== correctPointsEarned) {
      log.streakOnDay = correctStreakOnDay;
      log.pointsEarned = correctPointsEarned;
      await putRecord('dayLogs', log);
    }
  }

  // Recalculate hero points from corrected logs
  const correctLifetimePoints = completedLogs.reduce((s, l) => s + (l.pointsEarned || 0), 0);
  const totalConverted = rewardHistory.reduce((s, r) => s + (r.pointsConverted || 0), 0);
  const correctCurrentPoints = Math.max(0, correctLifetimePoints - totalConverted);

  // Recalculate running streak
  const lastCompletedDate = completedLogs.length > 0 ? completedLogs.at(-1).date : null;
  let streak = 0;
  if (lastCompletedDate) {
    const cursor = new Date(lastCompletedDate + 'T00:00:00');
    while (completedDateSet.has(dateStrFromDate(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const newLevel = calcLevel(correctLifetimePoints);
  await updateHero({
    currentPoints: correctCurrentPoints,
    lifetimePoints: correctLifetimePoints,
    streak,
    lastCompletedDate,
    level: newLevel,
  });

  return { streak, lastCompletedDate };
}

export function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getTodayLog() {
  return getRecord('dayLogs', todayStr());
}

export async function buildTodayLog(programId) {
  const today = todayStr();
  const existing = await getRecord('dayLogs', today);
  if (existing) return existing;

  const program = await getProgram(programId);
  if (!program) return null;

  const activeExercises = (program.exercises || [])
    .filter((e) => e.active)
    .sort((a, b) => a.order - b.order)
    .map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      target: e.target,
      done: false,
    }));

  const log = {
    date: today,
    programId,
    completed: false,
    exercises: activeExercises,
    pointsEarned: 0,
    streakOnDay: 0,
  };

  await putRecord('dayLogs', log);
  return log;
}

export async function markExerciseDone(date, exerciseId, done) {
  const log = await getRecord('dayLogs', date);
  if (!log) return null;

  log.exercises = log.exercises.map((e) =>
    e.id === exerciseId ? { ...e, done } : e
  );
  await putRecord('dayLogs', log);
  return log;
}

export async function completeDay() {
  const today = todayStr();
  const log = await getRecord('dayLogs', today);
  if (!log) throw new Error('No log for today');

  const hero = await getHero();

  // Calculate streak
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yy = yesterdayDate.getFullYear();
  const ym = String(yesterdayDate.getMonth() + 1).padStart(2, '0');
  const yd = String(yesterdayDate.getDate()).padStart(2, '0');
  const yesterdayStr = `${yy}-${ym}-${yd}`;

  let newStreak;
  if (hero.lastCompletedDate === yesterdayStr) {
    newStreak = (hero.streak || 0) + 1;
  } else {
    newStreak = 1;
  }

  // Points
  let pointsEarned = 1;
  let bonusEarned = false;
  if (newStreak % 5 === 0) {
    pointsEarned += 5;
    bonusEarned = true;
  }

  const newCurrentPoints = (hero.currentPoints || 0) + pointsEarned;
  const newLifetimePoints = (hero.lifetimePoints || 0) + pointsEarned;
  const newLevel = calcLevel(newLifetimePoints);

  // Save previous hero state so completion can be undone
  const previousHeroState = {
    currentPoints: hero.currentPoints || 0,
    lifetimePoints: hero.lifetimePoints || 0,
    streak: hero.streak || 0,
    lastCompletedDate: hero.lastCompletedDate || null,
    level: hero.level || 1,
  };

  await updateHero({
    currentPoints: newCurrentPoints,
    lifetimePoints: newLifetimePoints,
    streak: newStreak,
    lastCompletedDate: today,
    level: newLevel,
  });

  log.completed = true;
  log.pointsEarned = pointsEarned;
  log.streakOnDay = newStreak;
  log.previousHeroState = previousHeroState;
  await putRecord('dayLogs', log);

  return { pointsEarned, newStreak, bonusEarned };
}

export async function uncompleteDay() {
  const today = todayStr();
  const log = await getRecord('dayLogs', today);
  if (!log || !log.completed) throw new Error('Today is not completed');
  if (!log.previousHeroState) throw new Error('Cannot undo: no saved state');

  // Restore hero to pre-completion state
  await updateHero(log.previousHeroState);

  // Reset log
  log.completed = false;
  log.pointsEarned = 0;
  log.streakOnDay = 0;
  delete log.previousHeroState;
  await putRecord('dayLogs', log);
}

export async function rebuildTodayLog(programId) {
  const today = todayStr();
  const existing = await getRecord('dayLogs', today);
  // Only rebuild if today isn't completed yet
  if (existing && existing.completed) return existing;

  const program = await getProgram(programId);
  if (!program) return null;

  const activeExercises = (program.exercises || [])
    .filter((e) => e.active)
    .sort((a, b) => a.order - b.order)
    .map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      target: e.target,
      done: false,
    }));

  const log = {
    date: today,
    programId,
    completed: false,
    exercises: activeExercises,
    pointsEarned: 0,
    streakOnDay: 0,
  };

  await putRecord('dayLogs', log);
  return log;
}

export async function getDayLogs() {
  const logs = await getAllRecords('dayLogs');
  return logs.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function createAndCompletePastDay(date) {
  if (date === todayStr()) throw new Error('Use completeDay() for today');
  const existing = await getRecord('dayLogs', date);
  if (existing) throw new Error('A log already exists for this date');

  // Write a placeholder; recalculateAll will correct streakOnDay and pointsEarned
  await putRecord('dayLogs', {
    date,
    programId: null,
    completed: true,
    exercises: [],
    pointsEarned: 1,
    streakOnDay: 1,
    retroCompleted: true,
  });

  await recalculateAll();

  const updated = await getRecord('dayLogs', date);
  return { pointsEarned: updated.pointsEarned, streakOnDay: updated.streakOnDay };
}

export async function completePastDay(date) {
  if (date === todayStr()) throw new Error('Use completeDay() for today');
  const log = await getRecord('dayLogs', date);
  if (!log) throw new Error('No log found for ' + date);
  if (log.completed) throw new Error('Day is already completed');

  log.completed = true;
  log.retroCompleted = true;
  log.pointsEarned = 1;  // corrected by recalculateAll
  log.streakOnDay = 1;   // corrected by recalculateAll
  await putRecord('dayLogs', log);

  await recalculateAll();

  const updated = await getRecord('dayLogs', date);
  return { pointsEarned: updated.pointsEarned, streakOnDay: updated.streakOnDay };
}

export async function uncompletePastDay(date) {
  if (date === todayStr()) throw new Error('Use uncompleteDay() for today');
  const log = await getRecord('dayLogs', date);
  if (!log || !log.completed) throw new Error('Day is not completed');

  log.completed = false;
  log.pointsEarned = 0;
  log.streakOnDay = 0;
  delete log.retroCompleted;
  await putRecord('dayLogs', log);

  await recalculateAll();
}

export async function canCompleteToday() {
  const log = await getTodayLog();
  if (!log) return false;
  if (log.completed) return false;
  if (!log.exercises || log.exercises.length === 0) return false;
  return true;
}
