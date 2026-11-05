import type { Locator, Page } from '@playwright/test';
import { PageWaits, type EventOptions } from './waits';

export type DialogDecision = { action: 'accept'; promptText?: string } | { action: 'dismiss' };

/** Keep Locator actionability, strictness and native options intact. */
export class PageActions {
  constructor(readonly page: Page, readonly waits = new PageWaits(page)) {}

  click(target: Locator, options?: Parameters<Locator['click']>[0]): Promise<void> {
    return target.click(options);
  }

  fill(target: Locator, value: string, options?: Parameters<Locator['fill']>[1]): Promise<void> {
    return target.fill(value, options);
  }

  check(target: Locator, checked = true, options?: Parameters<Locator['setChecked']>[1]): Promise<void> {
    return target.setChecked(checked, options);
  }

  select(target: Locator, values: Parameters<Locator['selectOption']>[0], options?: Parameters<Locator['selectOption']>[1]): Promise<string[]> {
    return target.selectOption(values, options);
  }

  press(target: Locator, key: string, options?: Parameters<Locator['press']>[1]): Promise<void> {
    return target.press(key, options);
  }

  key(key: string): Promise<void> {
    return this.page.keyboard.press(key);
  }

  scroll(target: Locator, options?: Parameters<Locator['scrollIntoViewIfNeeded']>[0]): Promise<void> {
    return target.scrollIntoViewIfNeeded(options);
  }

  popup(action: () => Promise<unknown>, options?: EventOptions): Promise<Page> {
    return this.waits.popup(action, options);
  }

  async dialog(action: () => Promise<unknown>, decision: DialogDecision, options?: EventOptions): Promise<{ type: string; message: string; defaultValue: string }> {
    const dialog = await this.waits.dialog(action, (value) => decision.action === 'accept'
      ? value.accept(decision.promptText)
      : value.dismiss(), options);
    return { type: dialog.type(), message: dialog.message(), defaultValue: dialog.defaultValue() };
  }
}
