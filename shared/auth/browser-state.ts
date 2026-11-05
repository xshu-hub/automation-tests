import { randomUUID } from 'node:crypto';
import type { Page, Route } from '@playwright/test';
import { sessionStorageSchema } from '../input/schema';

/**
 * Seed a fresh about:blank page before yielding it to application code.
 * The caller must prepare each new independent page explicitly. Native popups
 * with an opener keep the browser's usual sessionStorage copy semantics.
 */
export async function injectSessionStorage(
  page: Page,
  origins: Record<string, Record<string, string>>,
): Promise<void> {
  if (!Object.keys(origins).length) return;
  const parsed = sessionStorageSchema.safeParse(origins);
  if (!parsed.success) throw new Error('Invalid external sessionStorage origins.');
  const states = Object.entries(parsed.data).filter(([, entries]) => Object.keys(entries).length);
  if (!states.length) return;
  if (page.url() !== 'about:blank') {
    throw new Error('Prepare sessionStorage on a fresh about:blank page before application navigation.');
  }

  for (const [origin, entries] of states) {
    const bootstrapURL = new URL(`/__automation_session_storage__/${randomUUID()}`, new URL(origin).origin).href;
    const matchesBootstrap = (url: URL) => url.href === bootstrapURL;
    const fulfillBootstrap = (route: Route) => route.fulfill({
      contentType: 'text/html',
      headers: { 'content-security-policy': "default-src 'none'" },
      body: '<!doctype html><meta charset="utf-8"><title>Session storage bootstrap</title>',
    });
    await page.route(matchesBootstrap, fulfillBootstrap);
    let bootstrapFailed = false;
    let bootstrapError: unknown;
    try {
      await page.goto(bootstrapURL, { waitUntil: 'load' });
      await page.evaluate((values) => {
        for (const [name, value] of Object.entries(values)) {
          window.sessionStorage.setItem(name, value);
        }
      }, entries);
    } catch (error) {
      bootstrapFailed = true;
      bootstrapError = error;
    }
    try {
      await page.unroute(matchesBootstrap, fulfillBootstrap);
    } catch (error) {
      if (bootstrapFailed) {
        throw new AggregateError([bootstrapError, error], 'Session storage bootstrap and route removal both failed.', { cause: error });
      }
      throw error;
    }
    if (bootstrapFailed) throw bootstrapError;
  }
  await page.goto('about:blank');
}
