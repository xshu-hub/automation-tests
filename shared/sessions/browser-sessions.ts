import { test, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test';
import { injectSessionStorage } from '../auth/browser-state';
import { resolveIdentity, resolveSystem, type RuntimeContext } from '../input/load';
import type { SessionIdentity } from './api-sessions';
import { ResourceScope } from './resource-scope';

export type SessionBrowserOptions = Omit<BrowserContextOptions, 'baseURL' | 'storageState' | 'extraHTTPHeaders' | 'httpCredentials' | 'clientCertificates'>;

export interface BrowserSession {
  readonly name: string;
  readonly system: string;
  readonly identity: string;
  readonly context: BrowserContext;
  /** Independent page, seeded once. Native opener popups retain native copy semantics. */
  newPage(): Promise<Page>;
  /** Runs a named business step without changing any global/current session. */
  step<T>(name: string, action: () => Promise<T>): Promise<T>;
}

export class BrowserSessions {
  private readonly scope = new ResourceScope();
  readonly cleanup = this.scope.cleanup;

  constructor(private readonly runtime: RuntimeContext, private readonly browser: Browser) {}

  create(name: string, options: SessionIdentity & { contextOptions?: SessionBrowserOptions } = {}): Promise<BrowserSession> {
    return this.scope.create(name, own => test.step(`Browser session ${name}`, async () => {
      const system = options.system ?? 'default';
      const configuration = resolveSystem(this.runtime, system);
      const identity = options.identity ?? configuration.defaultIdentity;
      const state = resolveIdentity(this.runtime, identity, system);
      const context = await this.browser.newContext({
        ...options.contextOptions,
        baseURL: configuration.webBaseURL,
        storageState: state.storageState,
        extraHTTPHeaders: {}, httpCredentials: undefined, clientCertificates: [],
      });
      own(() => context.close());
      return {
        name, system, identity, context,
        newPage: () => test.step(`Page in session ${name}`, async () => {
          const page = await context.newPage();
          try {
            await injectSessionStorage(page, state.sessionStorage);
            return page;
          } catch (error) {
            try { await page.close(); }
            catch (closeError) { throw new AggregateError([error, closeError], 'Page initialization and close failed.', { cause: closeError }); }
            throw error;
          }
        }),
        step: <T>(label: string, action: () => Promise<T>) => test.step(`${name}: ${label}`, action),
      };
    }));
  }

  dispose(): Promise<void> { return this.scope.dispose(); }
}
