import { expect, type Locator } from '@playwright/test';

export class Modal {
  constructor(readonly root: Locator, readonly closeButton: Locator) {}

  async expectOpen(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.root).toBeHidden();
  }
}
