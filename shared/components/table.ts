import type { Locator } from '@playwright/test';

/** Semantic HTML/ARIA table. Ambiguous rows stay ambiguous instead of silently choosing the first. */
export class Table {
  readonly rows: Locator;

  constructor(readonly root: Locator) {
    this.rows = root.getByRole('row').filter({ has: root.page().getByRole('cell') });
  }

  rowByCell(value: string): Locator {
    return this.rows.filter({ has: this.root.page().getByRole('cell', { name: value, exact: true }) });
  }

  cell(rowValue: string, columnIndex: number): Locator {
    return this.rowByCell(rowValue).getByRole('cell').nth(columnIndex);
  }
}
