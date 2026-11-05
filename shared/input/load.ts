import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { BrowserContextOptions } from '@playwright/test';
import { identitySchema, runtimeSchema, storageStateSchema, type IdentityInput, type RuntimeInput, type SystemInput } from './schema';

export type StorageState = Exclude<NonNullable<BrowserContextOptions['storageState']>, string>;

export interface ResolvedIdentity {
  storageState: StorageState;
  sessionStorage: Record<string, Record<string, string>>;
  api: { headers: Record<string, string>; storageState: StorageState };
  expiresAt?: string;
}

export interface RuntimeContext extends RuntimeInput {
  inputFile: string;
}

function normalizeState(state: StorageState): StorageState {
  const copy = structuredClone(state);
  copy.origins = copy.origins.map((entry) => ({ ...entry, origin: new URL(entry.origin).origin }));
  return copy;
}

function normalizeParsedIdentity(identity: IdentityInput): IdentityInput {
  return {
    ...identity,
    ...(identity.storageState && typeof identity.storageState !== 'string'
      ? { storageState: normalizeState(identity.storageState) } : {}),
    sessionStorage: Object.fromEntries(Object.entries(identity.sessionStorage)
      .map(([origin, entries]) => [new URL(origin).origin, { ...entries }])),
    api: {
      ...identity.api,
      headers: { ...identity.api.headers },
      ...(identity.api.storageState && typeof identity.api.storageState !== 'string'
        ? { storageState: normalizeState(identity.api.storageState) } : {}),
    },
  };
}

function readJSON(file: string): unknown {
  const content = readFileSync(file, 'utf8');
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('External input is not valid JSON. Check its syntax without logging credential values.');
  }
}

export function loadRuntime(inputFile: string, expectedTarget?: string): RuntimeContext {
  const absolutePath = resolve(inputFile);
  const result = runtimeSchema.safeParse(readJSON(absolutePath));
  if (!result.success) {
    // Report field locations only; input values may contain credentials.
    const fields = result.error.issues.map((issue) => issue.path.map((part, index) =>
      index > 0 && issue.path[index - 1] === 'sessionStorage' ? '<origin>' : part,
    ).join('.') || '<root>').join(', ');
    throw new Error(`Invalid external runtime input. Check fields: ${fields}`);
  }
  if (expectedTarget && result.data.target !== expectedTarget) {
    throw new Error(`Runtime input target must be "${expectedTarget}".`);
  }
  return {
    ...result.data,
    identities: Object.fromEntries(Object.entries(result.data.identities)
      .map(([name, identity]) => [name, normalizeParsedIdentity(identity)])),
    systems: Object.fromEntries(Object.entries(result.data.systems).map(([name, system]) => [name, {
      ...system,
      identities: Object.fromEntries(Object.entries(system.identities)
        .map(([identityName, identity]) => [identityName, normalizeParsedIdentity(identity)])),
    }])),
    inputFile: absolutePath,
  };
}

function readState(value: IdentityInput['storageState'], baseDirectory: string): StorageState {
  if (!value) return { cookies: [], origins: [] };
  const raw: unknown = typeof value === 'string'
    ? readJSON(resolve(baseDirectory, value))
    : value;
  const result = storageStateSchema.safeParse(raw);
  if (!result.success) throw new Error('Invalid Playwright storageState in external login state.');
  return normalizeState(result.data);
}

export function resolveSystem(runtime: RuntimeContext, name = 'default'): SystemInput {
  if (name === 'default') return runtime;
  const system = Object.hasOwn(runtime.systems, name) ? runtime.systems[name] : undefined;
  if (!system) throw new Error(`No external configuration for system "${name}".`);
  return system;
}

export function resolveIdentity(runtime: RuntimeContext, name: string, systemName = 'default'): ResolvedIdentity {
  const system = resolveSystem(runtime, systemName);
  // "anonymous" deliberately creates a fresh context without inherited credentials.
  if (name === 'anonymous') {
    return { storageState: { cookies: [], origins: [] }, sessionStorage: {},
      api: { headers: {}, storageState: { cookies: [], origins: [] } } };
  }
  const identity = Object.hasOwn(system.identities, name) ? system.identities[name] : undefined;
  if (!identity) throw new Error(`No external login state for identity "${name}".`);
  if (identity.expiresAt && Date.parse(identity.expiresAt) <= Date.now()) {
    throw new Error(`External login state for "${name}" has expired. Supply fresh state externally.`);
  }
  const directory = dirname(runtime.inputFile);
  const storageState = readState(identity.storageState, directory);
  return {
    storageState,
    sessionStorage: structuredClone(identity.sessionStorage),
    api: {
      headers: { ...identity.api.headers },
      storageState: identity.api.storageState
        ? readState(identity.api.storageState, directory) : structuredClone(storageState),
    },
    expiresAt: identity.expiresAt,
  };
}

// Useful for target adapters: normalization is performed once at the input boundary.
export function normalizeIdentity(input: unknown): IdentityInput {
  const result = identitySchema.safeParse(input);
  if (!result.success) throw new Error('Target adapter returned invalid external login state.');
  return normalizeParsedIdentity(result.data);
}
