import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

const reservedWindowsName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function validateSegment(value: string, label: string, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value) || reservedWindowsName.test(value)) {
    throw new Error(`${label} must be a non-reserved directory name containing only letters, numbers, hyphens or underscores.`);
  }
  return value;
}

export function validateTargetID(id: string): string {
  return validateSegment(id, 'Target ID (lowercase)', /^[a-z0-9][a-z0-9-]{0,127}$/);
}

/** A launcher creates a fresh attempt; config reloads and workers reuse its identifiers. */
export function initializeRun(env: NodeJS.ProcessEnv, freshAttempt = false): { runID: string; attemptID: string } {
  const runID = validateSegment(
    env.AUTOMATION_RUN_ID ?? `${Date.now()}-${randomUUID()}`,
    'AUTOMATION_RUN_ID', /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/,
  );
  const attemptID = validateSegment(
    freshAttempt ? randomUUID() : env.AUTOMATION_ATTEMPT_ID ?? randomUUID(),
    'AUTOMATION_ATTEMPT_ID', /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/,
  );
  env.AUTOMATION_RUN_ID = runID;
  env.AUTOMATION_ATTEMPT_ID = attemptID;
  return { runID, attemptID };
}

export function resolveArtifactOutput(
  target: string, environment: string, env: NodeJS.ProcessEnv = process.env,
): { runID: string; attemptID: string; artifactDirectory: string } {
  validateTargetID(target);
  validateSegment(environment, 'Environment', /^[a-zA-Z0-9_-]{1,128}$/);
  const identifiers = initializeRun(env);
  return {
    ...identifiers,
    artifactDirectory: resolve(repositoryRoot, 'artifacts', target, environment, identifiers.runID, identifiers.attemptID),
  };
}
