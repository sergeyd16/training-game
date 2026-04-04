import { getAllRecords, getRecord, putRecord, deleteRecord } from './storage.js';

export async function getPrograms() {
  return getAllRecords('programs');
}

export async function getProgram(id) {
  return getRecord('programs', id);
}

export async function saveProgram(program) {
  return putRecord('programs', program);
}

export async function deleteProgram(id) {
  return deleteRecord('programs', id);
}

export async function getActiveProgram() {
  const programs = await getAllRecords('programs');
  if (programs.length === 0) return null;
  return programs.find((p) => p.active) || programs[0];
}

export async function setActiveProgram(id) {
  const programs = await getAllRecords('programs');
  for (const p of programs) {
    p.active = (p.id === id);
    await putRecord('programs', p);
  }
}

export function createExercise(fields) {
  return {
    id: crypto.randomUUID(),
    name: fields.name ?? 'Exercise',
    type: fields.type ?? 'reps',
    target: fields.target ?? 10,
    order: fields.order ?? 0,
    active: fields.active !== undefined ? fields.active : true,
  };
}

export function createProgram(fields) {
  return {
    id: crypto.randomUUID(),
    name: fields.name ?? 'New Program',
    active: fields.active !== undefined ? fields.active : false,
    exercises: [],
  };
}
