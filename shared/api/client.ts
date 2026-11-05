import { test, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { RequestOptions } from './types';

export type { ApiContextOptions, RequestOptions } from './types';

/** Keeps Playwright's native request options and response object available. */
export class ApiClient {
  private readonly baseURL: URL;

  constructor(readonly context: APIRequestContext, baseURL: string, private readonly label?: string) {
    this.baseURL = new URL(baseURL.endsWith('/') ? baseURL : `${baseURL}/`);
  }

  async send(method: string, path: string, options: RequestOptions = {}): Promise<APIResponse> {
    const url = new URL(path, this.baseURL);
    if (url.username || url.password) {
      throw new Error('API request URLs must not contain credentials.');
    }
    if (url.origin !== this.baseURL.origin) {
      throw new Error('ApiClient only accepts requests to its configured API origin.');
    }
    // No query strings, headers or bodies are included in the framework step title.
    const verb = method.toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(verb) && (options.maxRetries ?? 0) !== 0) {
      throw new Error('Automatic retries are not allowed for write requests.');
    }
    return test.step(`API${this.label ? ` [${this.label}]` : ''} ${verb} ${url.pathname}`, () => this.context.fetch(url.href, {
      maxRetries: 0,
      ...options,
      method,
      // Keep this after options so untyped callers cannot bypass the origin boundary.
      maxRedirects: 0,
    }));
  }

  get(path: string, options?: RequestOptions) { return this.send('GET', path, options); }
  post(path: string, options?: RequestOptions) { return this.send('POST', path, options); }
  put(path: string, options?: RequestOptions) { return this.send('PUT', path, options); }
  patch(path: string, options?: RequestOptions) { return this.send('PATCH', path, options); }
  delete(path: string, options?: RequestOptions) { return this.send('DELETE', path, options); }
  head(path: string, options?: RequestOptions) { return this.send('HEAD', path, options); }
}
