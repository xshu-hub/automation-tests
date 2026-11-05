import type { Locator } from '@playwright/test';

/** A labelled form. Field labels are a target's accessibility contract, not framework selectors. */
export class Form {
  constructor(readonly root: Locator) {}

  field(label: string): Locator {
    return this.root.getByLabel(label, { exact: true });
  }

  async fill(values: Record<string, string>): Promise<void> {
    for (const [label, value] of Object.entries(values)) await this.field(label).fill(value);
  }

  check(label: string, checked = true): Promise<void> {
    return this.field(label).setChecked(checked);
  }

  select(label: string, value: string | string[]): Promise<string[]> {
    return this.field(label).selectOption(value);
  }

  submit(buttonName: string): Promise<void> {
    return this.root.getByRole('button', { name: buttonName, exact: true }).click();
  }
}
