import type { Page } from '@playwright/test';

export type StorageArea = 'local' | 'session';

/** Explicit mutations of the current document's origin. This does not obtain or restore login state. */
export class PageStorage {
  constructor(readonly page: Page) {}

  get(area: StorageArea, key: string): Promise<string | null> {
    return this.page.evaluate(({ area, key }) => (area === 'local' ? localStorage : sessionStorage).getItem(key), { area, key });
  }

  set(area: StorageArea, key: string, value: string): Promise<void> {
    return this.page.evaluate(({ area, key, value }) => (area === 'local' ? localStorage : sessionStorage).setItem(key, value), { area, key, value });
  }

  remove(area: StorageArea, key: string): Promise<void> {
    return this.page.evaluate(({ area, key }) => (area === 'local' ? localStorage : sessionStorage).removeItem(key), { area, key });
  }

  clear(area: StorageArea): Promise<void> {
    return this.page.evaluate((area) => (area === 'local' ? localStorage : sessionStorage).clear(), area);
  }

  entries(area: StorageArea): Promise<Record<string, string>> {
    return this.page.evaluate((area) => Object.fromEntries(Object.entries(area === 'local' ? localStorage : sessionStorage)), area);
  }
}
