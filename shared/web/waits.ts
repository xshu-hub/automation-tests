import type { Dialog, Download, FileChooser, Page, Request, Response } from '@playwright/test';

export interface EventOptions {
  timeout?: number;
}

type Subscribe<T> = (listener: (event: T) => void) => () => void;

/** One action, one matching event. All listeners/timers are removed on every exit path. */
async function eventDuring<T>(
  page: Page,
  subscribe: Subscribe<T>,
  action: () => Promise<unknown>,
  label: string,
  timeout: number,
  predicate: (event: T) => boolean = () => true,
  handle?: (event: T) => Promise<void>,
): Promise<T> {
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('Event timeout must be a positive number.');
  let unsubscribe = (): void => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let rejectEvent: (error: Error) => void = () => {};
  const onClosed = (): void => { rejectEvent(new Error(`Page closed while waiting for ${label}.`)); };
  const onCrashed = (): void => { rejectEvent(new Error(`Page crashed while waiting for ${label}.`)); };
  const cleanup = (): void => {
    unsubscribe();
    if (timer) clearTimeout(timer);
    page.off('close', onClosed);
    page.off('crash', onCrashed);
  };
  const event = new Promise<T>((resolve, reject) => {
    rejectEvent = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    unsubscribe = subscribe((value) => {
      if (settled) return;
      try {
        if (!predicate(value)) return;
      } catch (error) {
        rejectEvent(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      settled = true;
      cleanup();
      // Dialogs need handling before the action can complete.
      Promise.resolve().then(() => handle?.(value)).then(() => resolve(value), reject);
    });
    page.on('close', onClosed);
    page.on('crash', onCrashed);
    timer = setTimeout(() => rejectEvent(new Error(`Timed out after ${timeout}ms waiting for ${label}.`)), timeout);
    if (page.isClosed()) rejectEvent(new Error(`Page is already closed while waiting for ${label}.`));
  });
  try {
    const [value] = await Promise.all([event, Promise.resolve().then(action)]);
    return value;
  } finally {
    cleanup();
  }
}

export class PageWaits {
  constructor(readonly page: Page, readonly eventTimeout = 10_000) {}

  response(action: () => Promise<unknown>, predicate: (response: Response) => boolean, options: EventOptions = {}): Promise<Response> {
    return eventDuring(this.page, (listener) => {
      this.page.on('response', listener);
      return () => this.page.off('response', listener);
    }, action, 'response', options.timeout ?? this.eventTimeout, predicate);
  }

  request(action: () => Promise<unknown>, predicate: (request: Request) => boolean, options: EventOptions = {}): Promise<Request> {
    return eventDuring(this.page, (listener) => {
      this.page.on('request', listener);
      return () => this.page.off('request', listener);
    }, action, 'request', options.timeout ?? this.eventTimeout, predicate);
  }

  popup(action: () => Promise<unknown>, options: EventOptions = {}): Promise<Page> {
    return eventDuring(this.page, (listener) => {
      this.page.on('popup', listener);
      return () => this.page.off('popup', listener);
    }, action, 'popup', options.timeout ?? this.eventTimeout);
  }

  download(action: () => Promise<unknown>, options: EventOptions = {}): Promise<Download> {
    return eventDuring(this.page, (listener) => {
      this.page.on('download', listener);
      return () => this.page.off('download', listener);
    }, action, 'download', options.timeout ?? this.eventTimeout);
  }

  fileChooser(action: () => Promise<unknown>, options: EventOptions = {}): Promise<FileChooser> {
    return eventDuring(this.page, (listener) => {
      this.page.on('filechooser', listener);
      return () => this.page.off('filechooser', listener);
    }, action, 'file chooser', options.timeout ?? this.eventTimeout);
  }

  dialog(action: () => Promise<unknown>, handle: (dialog: Dialog) => Promise<void>, options: EventOptions = {}): Promise<Dialog> {
    return eventDuring(this.page, (listener) => {
      this.page.on('dialog', listener);
      return () => this.page.off('dialog', listener);
    }, action, 'dialog', options.timeout ?? this.eventTimeout, undefined, handle);
  }
}
