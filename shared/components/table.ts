import type { Locator } from '@playwright/test';

/** Semantic HTML/ARIA table. Ambiguous rows stay ambiguous instead of silently choosing the first. */
export class Table {
  readonly rows: Locator;

  constructor(readonly root: Locator) {
    this.rows = root.getByRole('row').filter({ has: this.cells() });
  }

  rowByCell(value: string): Locator {
    return this.rows.filter({ has: this.cells(value) });
  }

  cell(rowValue: string, columnIndex: number): Locator {
    if (!Number.isInteger(columnIndex) || columnIndex < 0) throw new Error('Column index must be a non-negative integer.');
    // Apply the column index inside EACH matching row, preserving duplicate-row strictness.
    return this.rowByCell(rowValue).locator(this.cells().nth(columnIndex));
  }

  private cells(value?: string): Locator {
    const options = value === undefined ? {} : { name: value, exact: true };
    return this.root.page().getByRole('cell', options).or(this.root.page().getByRole('gridcell', options));
  }
}
