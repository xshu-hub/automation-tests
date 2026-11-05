import { expect, test, type FrameLocator, type Locator, type Page, type Response } from '@playwright/test';
import { PageActions } from './actions';
import { PageFiles } from './files';
import { PageStorage } from './storage';
import { withQuery, type Query } from './urls';
import { PageWaits } from './waits';

type NativeNavigationOptions = Omit<NonNullable<Parameters<Page['goto']>[1]>, 'waitUntil'> & {
  waitUntil?: 'load' | 'domcontentloaded' | 'commit';
};

export interface NavigationOptions extends NativeNavigationOptions {
  expectedStatus?: number | readonly number[];
}

export interface OpenOptions extends NavigationOptions {
  query?: Query;
}

/** A small page lifecycle plus composable browser capabilities; native Page remains available. */
export abstract class BasePage {
  /** Native URL rules apply: `items` is base-relative, `/items` is origin-relative. */
  abstract readonly path: string;
  protected abstract readonly ready: Locator;
  readonly waits: PageWaits;
  readonly actions: PageActions;
  readonly files: PageFiles;
  readonly storage: PageStorage;

  constructor(readonly page: Page) {
    this.waits = new PageWaits(page);
    this.actions = new PageActions(page, this.waits);
    this.files = new PageFiles(page, this.waits);
    this.storage = new PageStorage(page);
  }

  async open(options: OpenOptions = {}): Promise<Response | null> {
    const { query, expectedStatus, ...navigation } = options;
    const response = await this.page.goto(withQuery(this.path, query), { waitUntil: 'domcontentloaded', ...navigation });
    this.checkDocument(response, expectedStatus);
    await this.expectReady();
    return response;
  }

  /** Override for hydration or other page-specific readiness; never assume network idleness. */
  async expectReady(): Promise<void> {
    await expect(this.ready, `${this.constructor.name} is ready`).toBeVisible();
  }

  async reload(options: NavigationOptions = {}): Promise<Response | null> {
    const { expectedStatus, ...navigation } = options;
    const response = await this.page.reload({ waitUntil: 'domcontentloaded', ...navigation });
    this.checkDocument(response, expectedStatus);
    await this.expectReady();
    return response;
  }

  /** History can land on a different page object; the caller checks that destination's readiness. */
  async back(options: NavigationOptions = {}): Promise<Response | null> {
    const { expectedStatus, ...navigation } = options;
    const response = await this.page.goBack({ waitUntil: 'domcontentloaded', ...navigation });
    this.checkDocument(response, expectedStatus);
    return response;
  }

  async forward(options: NavigationOptions = {}): Promise<Response | null> {
    const { expectedStatus, ...navigation } = options;
    const response = await this.page.goForward({ waitUntil: 'domcontentloaded', ...navigation });
    this.checkDocument(response, expectedStatus);
    return response;
  }

  frame(target: string | Locator): FrameLocator {
    return typeof target === 'string' ? this.page.frameLocator(target) : target.contentFrame();
  }

  step<T>(name: string, body: () => Promise<T>): Promise<T> {
    return test.step(name, body, { box: true });
  }

  async screenshot(name: string, options?: Omit<NonNullable<Parameters<Page['screenshot']>[0]>, 'path' | 'type'>): Promise<Buffer> {
    const body = await this.page.screenshot({ ...options, type: 'png' });
    await test.info().attach(name, { body, contentType: 'image/png' });
    return body;
  }

  protected checkDocument(response: Response | null, expectedStatus?: number | readonly number[]): void {
    if (!response) return; // Same-document/hash navigations and empty history have no document response.
    const status = response.status();
    const accepted = expectedStatus === undefined
      ? status >= 200 && status < 300
      : typeof expectedStatus === 'number' ? status === expectedStatus : expectedStatus.includes(status);
    if (!accepted) throw new Error(`${this.constructor.name} navigation returned HTTP ${status}.`);
  }
}
