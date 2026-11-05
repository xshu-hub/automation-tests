import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { PageActions } from './actions';
import { PageFiles } from './files';
import { PageWaits } from './waits';

export type ViewRoot = Page | FrameLocator | Locator;

/** A scoped business region, including nested frames. Navigation belongs to BasePage. */
export abstract class BaseView {
  protected abstract readonly ready: Locator;
  readonly waits: PageWaits;
  readonly actions: PageActions;
  readonly files: PageFiles;

  constructor(readonly page: Page, readonly root: ViewRoot) {
    this.waits = new PageWaits(page);
    this.actions = new PageActions(page, this.waits);
    this.files = new PageFiles(page, this.waits);
  }

  async expectReady(): Promise<void> {
    await expect(this.ready, `${this.constructor.name} is ready`).toBeVisible();
  }

  /** String selectors are relative to this view; explicit iframe Locators retain their scope. */
  frame(target: string | Locator): FrameLocator {
    return typeof target === 'string' ? this.root.frameLocator(target) : target.contentFrame();
  }

  step<T>(name: string, action: () => Promise<T>): Promise<T> {
    return test.step(`${this.constructor.name}: ${name}`, action, { box: true });
  }
}
