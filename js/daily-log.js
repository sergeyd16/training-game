import { getRecord, putRecord, getAllRecords } from './storage.js';
import { getHero, updateHero, calcLevel } from './hero.js';
import { getProgram } from './programs.js';

async function recalculateHeroStreak() {
  const logs = await getAllRecords('dayLogs');
  const completedDates = new Set(logs.filter((l) => l.completed).map((l) => l.date));

  if (completedDates.size === 0) {
    return { streak: 0, lastCompletedDate: null };
  }

  const lastCompletedDate = Array.from(completedDates).sort().at(-1);

  let streak = 0;
  const cursor = new Date(lastCompletedDate + 'T00:00:00');
  while (true) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    if (completedDates.has(`${y}-${m}-${d}`)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

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

  const hero = await getHero();

  const previousHeroState = {
    currentPoints: hero.currentPoints || 0,
    lifetimePoints: hero.lifetimePoints || 0,
    streak: hero.streak || 0,
    lastCompletedDate: hero.lastCompletedDate || null,
    level: hero.level || 1,
  };

  const newCurrentPoints = (hero.currentPoints || 0) + 1;
  const newLifetimePoints = (hero.lifetimePoints || 0) + 1;
  const newLevel = calcLevel(newLifetimePoints);

  // Determine streakOnDay based on the previous day
  const prevCursor = new Date(date + 'T00:00:00');
  prevCursor.setDate(prevCursor.getDate() - 1);
  const py = prevCursor.getFullYear();
  const pm = String(prevCursor.getMonth() + 1).padStart(2, '0');
  const pd = String(prevCursor.getDate()).padStart(2, '0');
  const prevDayLog = await getRecord('dayLogs', `${py}-${pm}-${pd}`);
  const streakOnDay = prevDayLog?.completed ? (prevDayLog.streakOnDay || 0) + 1 : 1;

  const log = {
    date,
    programId: null,
    completed: true,
    exercises: [],
    pointsEarned: 1,
    streakOnDay,
    retroCompleted: true,
    previousHeroState,
  };
  await putRecord('dayLogs', log);

  const { streak: newStreak, lastCompletedDate } = await recalculateHeroStreak();
  await updateHero({
    currentPoints: newCurrentPoints,
    lifetimePoints: newLifetimePoints,
    streak: newStreak,
    lastCompletedDate,
    level: newLevel,
  });
}

export async function completePastDay(date) {
  if (date === todayStr()) throw new Error('Use completeDay() for today');
  const log = await getRecord('dayLogs', date);
  if (!log) throw new Error('No log found for ' + date);
  if (log.completed) throw new Error('Day is already completed');

  const hero = await getHero();

  const previousHeroState = {
    currentPoints: hero.currentPoints || 0,
    lifetimePoints: hero.lifetimePoints || 0,
    streak: hero.streak || 0,
    lastCompletedDate: hero.lastCompletedDate || null,
    level: hero.level || 1,
  };

  const newCurrentPoints = (hero.currentPoints || 0) + 1;
  const newLifetimePoints = (hero.lifetimePoints || 0) + 1;
  const newLevel = calcLevel(newLifetimePoints);

  log.completed = true;
  log.pointsEarned = 1;
  log.retroCompleted = true;
  log.previousHeroState = previousHeroState;
  await putRecord('dayLogs', log);

  const { streak: newStreak, lastCompletedDate } = await recalculateHeroStreak();

  // Update streakOnDay for this log based on recalculated streak
  const prevDayCursor = new Date(date + 'T00:00:00');
  prevDayCursor.setDate(prevDayCursor.getDate() - 1);
  const py = prevDayCursor.getFullYear();
  const pm = String(prevDayCursor.getMonth() + 1).padStart(2, '0');
  const pd = String(prevDayCursor.getDate()).padStart(2, '0');
  const prevDayLog = await getRecord('dayLogs', `${py}-${pm}-${pd}`);
  log.streakOnDay = prevDayLog?.completed ? (prevDayLog.streakOnDay || 0) + 1 : 1;
  await putRecord('dayLogs', log);

  await updateHero({
    currentPoints: newCurrentPoints,
    lifetimePoints: newLifetimePoints,
    streak: newStreak,
    lastCompletedDate,
    level: newLevel,
  });
}

export async function uncompletePastDay(date) {
  if (date === todayStr()) throw new Error('Use uncompleteDay() for today');
  const log = await getRecord('dayLogs', date);
  if (!log || !log.completed) throw new Error('Day is not completed');

  const hero = await getHero();
  const pointsToRemove = log.pointsEarned || 0;

  log.completed = false;
  log.pointsEarned = 0;
  log.streakOnDay = 0;
  delete log.retroCompleted;
  delete log.previousHeroState;
  await putRecord('dayLogs', log);

  const newCurrentPoints = Math.max(0, (hero.currentPoints || 0) - pointsToRemove);
  const newLifetimePoints = Math.max(0, (hero.lifetimePoints || 0) - pointsToRemove);
  const newLevel = calcLevel(newLifetimePoints);
  const { streak: newStreak, lastCompletedDate } = await recalculateHeroStreak();

  await updateHero({
    currentPoints: newCurrentPoints,
    lifetimePoints: newLifetimePoints,
    streak: newStreak,
    lastCompletedDate,
    level: newLevel,
  });
}

export async function canCompleteToday() {
  const log = await getTodayLog();
  if (!log) return false;
  if (log.completed) return false;
  if (!log.exercises || log.exercises.length === 0) return false;
  return true;
}
