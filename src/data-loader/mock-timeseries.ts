import type { TimePoint } from '../types/number';

export function loadMockTimeseries(): TimePoint[] {
  const data: TimePoint[] = [];
  for (let i = 0; i < 30; i++) {
    data.push({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      value: 100 + Math.random() * 50,
    });
  }
  return data;
}
