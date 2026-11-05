import { randomUUID } from 'node:crypto';

export function uniqueName(prefix = 'test'): string {
  return `${prefix}-${randomUUID()}`;
}
