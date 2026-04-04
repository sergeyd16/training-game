import { getRecord, putRecord, getAllRecords } from './storage.js';
import { getHero, updateHero, calcLevel } from './hero.js';
import { getProgram } from './programs.js';

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
  await putRecord('dayLogs', log);

  return { pointsEarned, newStreak, bonusEarned };
}

export async function getDayLogs() {
  const logs = await getAllRecords('dayLogs');
  return logs.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function canCompleteToday() {
  const log = await getTodayLog();
  if (!log) return false;
  if (log.completed) return false;
  if (!log.exercises || log.exercises.length === 0) return false;
  return true;
}
