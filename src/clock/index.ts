// Час для тестованості: код бере поточний момент лише з clock.now().
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(at: Date): Clock {
  return { now: () => new Date(at.getTime()) };
}

// CLOCK_FIXED_NOW (ISO-рядок) фіксує час на локальному стенді.
export function clockFromEnv(value = process.env.CLOCK_FIXED_NOW): Clock {
  if (!value) return systemClock;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) throw new Error(`CLOCK_FIXED_NOW is not a date: ${value}`);
  return fixedClock(at);
}
