import { expect, type Locator } from '@playwright/test';

export interface PaginationControls {
  next: Locator;
  previous: Locator;
  current: Locator;
}

export class Pagination {
  constructor(readonly root: Locator, readonly controls: PaginationControls) {}

  async next(): Promise<void> {
    await this.move(this.controls.next);
  }

  async previous(): Promise<void> {
    await this.move(this.controls.previous);
  }

  private async move(button: Locator): Promise<void> {
    await expect(this.root).toBeVisible();
    const before = await this.controls.current.innerText();
    await button.click();
    await expect(this.controls.current).not.toHaveText(before);
  }
}
