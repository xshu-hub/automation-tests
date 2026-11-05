import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { ApiClient } from '../api/client';
import { createApiContext } from '../api/context';
import { injectSessionStorage } from '../auth/browser-state';
import { CleanupStack } from '../data/cleanup';
import { loadRuntime, resolveIdentity, type ResolvedIdentity, type RuntimeContext } from '../input/load';
import type { ApiContextOptions } from '../api/types';
import { ApiSessions } from '../sessions/api-sessions';
import { BrowserSessions } from '../sessions/browser-sessions';

export interface BaseOptions {
  identity: string;
  apiOptions: ApiContextOptions;
}

interface BaseFixtures {
  authState: ResolvedIdentity;
  apiContext: APIRequestContext;
  api: ApiClient;
  cleanup: CleanupStack;
  apiSessions: ApiSessions;
  browserSessions: BrowserSessions;
}

interface WorkerFixtures {
  runtime: RuntimeContext;
}

export const test = base.extend<BaseOptions & BaseFixtures, WorkerFixtures>({
  identity: [process.env.AUTOMATION_IDENTITY || '', { option: true }],
  apiOptions: [{}, { option: true }],

  runtime: [async ({}, use) => {
    const file = process.env.AUTOMATION_INPUT;
    if (!file) throw new Error('Supply external runtime input with --input or AUTOMATION_INPUT.');
    await use(loadRuntime(file));
  }, { scope: 'worker' }],

  authState: async ({ runtime, identity }, use) => {
    await use(resolveIdentity(runtime, identity || runtime.defaultIdentity));
  },

  storageState: async ({ authState }, use) => {
    await use(authState.storageState);
  },

  page: async ({ page, authState }, use) => {
    // Seed the fresh tab once, before application navigation. Never replay it on reload.
    await injectSessionStorage(page, authState.sessionStorage);
    await use(page);
  },

  apiContext: async ({ runtime, authState, apiOptions }, use) => {
    const context = await createApiContext(runtime.apiBaseURL, authState.api, apiOptions);
    try {
      await use(context);
    } finally {
      await context.dispose();
    }
  },

  api: async ({ apiContext, runtime }, use) => {
    await use(new ApiClient(apiContext, runtime.apiBaseURL));
  },

  apiSessions: async ({ runtime, apiOptions }, use) => {
    const sessions = new ApiSessions(runtime, apiOptions);
    try { await use(sessions); } finally { await sessions.dispose(); }
  },

  // Declared API dependency keeps all named API sessions alive during browser cleanup.
  browserSessions: async ({ runtime, browser, apiSessions: _apiSessions }, use) => {
    const sessions = new BrowserSessions(runtime, browser);
    try { await use(sessions); } finally { await sessions.dispose(); }
  },

  cleanup: async ({ apiContext: _apiContext, apiSessions: _apiSessions }, use) => {
    const stack = new CleanupStack();
    try {
      await use(stack);
    } finally {
      await stack.dispose();
    }
  },
});

export { expect };
