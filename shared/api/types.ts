import type { APIRequest, APIRequestContext } from '@playwright/test';

type NativeRequestOptions = NonNullable<Parameters<APIRequestContext['fetch']>[1]>;

/**
 * Redirects are disabled by ApiClient to keep every request on its configured origin.
 * Use the native apiContext explicitly for scenarios that require following redirects.
 */
export type RequestOptions = Omit<NativeRequestOptions, 'method' | 'maxRedirects'>;

/** Runtime input and the selected identity own the API destination and credentials. */
export type ApiContextOptions = Omit<
  NonNullable<Parameters<APIRequest['newContext']>[0]>,
  'baseURL' | 'storageState' | 'extraHTTPHeaders'
>;
