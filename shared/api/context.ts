import { request, type APIRequestContext } from '@playwright/test';
import type { ResolvedIdentity } from '../input/load';
import type { ApiContextOptions } from './types';

/** Default and named API fixtures share destination/credential precedence. */
export function createApiContext(
  baseURL: string, state: ResolvedIdentity['api'], options: ApiContextOptions = {},
): Promise<APIRequestContext> {
  // Validate at runtime too: JSON/JavaScript callers can bypass TypeScript's Omit.
  if (('httpCredentials' in options && options.httpCredentials !== undefined)
    || ('clientCertificates' in options && options.clientCertificates !== undefined)) {
    throw new Error('API credentials must come from external identity input; HTTP Basic and client certificates are not supported by this input contract.');
  }
  return request.newContext({
    failOnStatusCode: false,
    timeout: 15_000,
    ignoreHTTPSErrors: false,
    maxRedirects: 0,
    ...options,
    baseURL: baseURL.endsWith('/') ? baseURL : `${baseURL}/`,
    storageState: state.storageState,
    extraHTTPHeaders: state.headers,
  });
}
