import { expect, type Locator } from '@playwright/test';

/** A custom single-select; listbox may be rendered in a portal outside the trigger's container. */
export class SingleSelect {
  constructor(readonly trigger: Locator, readonly listbox: Locator) {}

  async select(label: string): Promise<void> {
    await this.trigger.click();
    await expect(this.listbox).toBeVisible();
    await this.listbox.getByRole('option', { name: label, exact: true }).click();
    await expect(this.listbox).toBeHidden();
  }
}
