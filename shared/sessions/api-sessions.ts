import { test, type APIRequestContext } from '@playwright/test';
import { ApiClient } from '../api/client';
import { createApiContext } from '../api/context';
import type { ApiContextOptions } from '../api/types';
import { resolveIdentity, resolveSystem, type RuntimeContext } from '../input/load';
import { ResourceScope } from './resource-scope';

export interface SessionIdentity {
  system?: string;
  identity?: string;
}

export interface ApiSession {
  readonly name: string;
  readonly system: string;
  readonly identity: string;
  readonly context: APIRequestContext;
  readonly api: ApiClient;
}

export class ApiSessions {
  private readonly scope = new ResourceScope();
  readonly cleanup = this.scope.cleanup;

  constructor(private readonly runtime: RuntimeContext, private readonly defaults: ApiContextOptions = {}) {}

  create(name: string, options: SessionIdentity & { apiOptions?: ApiContextOptions } = {}): Promise<ApiSession> {
    return this.scope.create(name, own => test.step(`API session ${name}`, async () => {
      const system = options.system ?? 'default';
      const configuration = resolveSystem(this.runtime, system);
      const identity = options.identity ?? configuration.defaultIdentity;
      const state = resolveIdentity(this.runtime, identity, system);
      const context = await createApiContext(configuration.apiBaseURL, state.api, { ...this.defaults, ...options.apiOptions });
      own(() => context.dispose());
      return { name, system, identity, context, api: new ApiClient(context, configuration.apiBaseURL, name) };
    }));
  }

  dispose(): Promise<void> { return this.scope.dispose(); }
}
