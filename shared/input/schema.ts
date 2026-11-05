import { z } from 'zod';

const httpURL = z.url().refine((value) => /^https?:\/\//.test(value), 'Use an HTTP(S) URL');
const baseURL = httpURL.regex(/^https?:\/\/[^/?#@\\]+(?:\/[^?#]*)?$/, 'Base URLs must not contain credentials, a query or fragment');
// Accept a trailing slash and default ports, then canonicalize at the input boundary.
const httpOrigin = httpURL.regex(/^https?:\/\/[^/?#@\\]+\/?$/, 'Use an HTTP(S) origin without credentials or a path');
const strings = z.record(z.string(), z.string());

const cookie = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().min(1),
  path: z.string().min(1),
  expires: z.number(),
  httpOnly: z.boolean(),
  secure: z.boolean(),
  sameSite: z.enum(['Strict', 'Lax', 'None']),
}).passthrough();

export const sessionStorageSchema = z.record(httpOrigin, strings).superRefine((states, context) => {
  const origins = new Set<string>();
  for (const origin of Object.keys(states)) {
    const canonical = new URL(origin).origin;
    if (origins.has(canonical)) {
      context.addIssue({ code: 'custom', message: 'Supply only one sessionStorage entry per origin' });
      return;
    }
    origins.add(canonical);
  }
});

// Extra origin fields (e.g. IndexedDB) are passed through to Playwright unchanged.
export const storageStateSchema = z.object({
  cookies: z.array(cookie),
  origins: z.array(z.object({
    origin: httpOrigin,
    localStorage: z.array(z.object({ name: z.string(), value: z.string() })),
  }).passthrough()),
}).passthrough();

export const identitySchema = z.object({
  storageState: z.union([z.string().min(1), storageStateSchema]).optional(),
  sessionStorage: sessionStorageSchema.default({}),
  api: z.object({
    headers: strings.default({}),
    storageState: z.union([z.string().min(1), storageStateSchema]).optional(),
  }).default({ headers: {} }),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});

export const runtimeSchema = z.object({
  target: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  environment: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  webBaseURL: baseURL,
  apiBaseURL: baseURL,
  defaultIdentity: z.string().min(1).default('default'),
  identities: z.record(z.string().min(1), identitySchema),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type RuntimeInput = z.infer<typeof runtimeSchema>;
export type IdentityInput = z.infer<typeof identitySchema>;
