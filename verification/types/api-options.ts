import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ApiClient, ApiContextOptions, RequestOptions } from '../../shared/api/client';

/** Compiled by typecheck; this function is never executed as a test. */
export function verifyApiOptionTypes(api: ApiClient, context: APIRequestContext): Promise<APIResponse> {
  const options: RequestOptions = {
    params: { page: 1 },
    headers: { Accept: 'application/json' },
    timeout: 1_000,
  };
  const contextOptions: ApiContextOptions = { timeout: 1_000, proxy: { server: 'http://localhost:8080' } };
  void contextOptions;

  // @ts-expect-error Unknown request option must be rejected.
  api.get('items', { timoeut: 1_000 });
  // @ts-expect-error Native option value types must be preserved.
  api.get('items', { headers: 42 });
  // @ts-expect-error Options must be an object, rather than the old empty type.
  api.get('items', 5);
  // @ts-expect-error The named method cannot be overridden by request options.
  api.get('items', { method: 'POST' });
  // @ts-expect-error Redirects require the explicit native API context.
  api.get('items', { maxRedirects: 1 });
  // @ts-expect-error External runtime input owns the API destination.
  const destinationOverride: ApiContextOptions = { baseURL: 'https://example.invalid' };
  // @ts-expect-error The selected identity owns API headers.
  const headerOverride: ApiContextOptions = { extraHTTPHeaders: { Authorization: 'test-only' } };
  // @ts-expect-error The selected identity owns API storage state.
  const stateOverride: ApiContextOptions = { storageState: { cookies: [], origins: [] } };
  void destinationOverride;
  void headerOverride;
  void stateOverride;

  context.get('items', { maxRedirects: 1 });
  return api.get('items', options);
}
