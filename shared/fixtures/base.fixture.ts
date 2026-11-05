import { request, test as base, expect, type APIRequestContext } from '@playwright/test';
import { ApiClient } from '../api/client';
import { injectSessionStorage } from '../auth/browser-state';
import { CleanupStack } from '../data/cleanup';
import { loadRuntime, resolveIdentity, type ResolvedIdentity, type RuntimeContext } from '../input/load';
import type { ApiContextOptions } from '../api/types';

export interface BaseOptions {
  identity: string;
  apiOptions: ApiContextOptions;
}

interface BaseFixtures {
  authState: ResolvedIdentity;
  apiContext: APIRequestContext;
  api: ApiClient;
  cleanup: CleanupStack;
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
    const context = await request.newContext({
      failOnStatusCode: false,
      timeout: 15_000,
      ignoreHTTPSErrors: false,
      maxRedirects: 0,
      ...apiOptions,
      baseURL: runtime.apiBaseURL.endsWith('/') ? runtime.apiBaseURL : `${runtime.apiBaseURL}/`,
      storageState: authState.api.storageState,
      extraHTTPHeaders: authState.api.headers,
    });
    try {
      await use(context);
    } finally {
      await context.dispose();
    }
  },

  api: async ({ apiContext, runtime }, use) => {
    await use(new ApiClient(apiContext, runtime.apiBaseURL));
  },

  cleanup: async ({ apiContext: _apiContext }, use) => {
    const stack = new CleanupStack();
    try {
      await use(stack);
    } finally {
      await stack.dispose();
    }
  },
});

export { expect };
