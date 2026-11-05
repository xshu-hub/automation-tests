import { expect, type APIResponse } from '@playwright/test';
import type { z } from 'zod';

export async function expectJson<T extends z.ZodType>(
  response: APIResponse,
  options: { status: number; schema: T },
): Promise<z.infer<T>> {
  const status = response.status();
  expect(status, 'HTTP status').toBe(options.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // JSON parser errors may quote the response body, including credential values.
    throw new Error(`Could not read a JSON response body (HTTP ${status}). Inspect the protected trace.`);
  }
  const result = await options.schema.safeParseAsync(body);
  if (!result.success) {
    // Custom Zod messages may contain input values; report structural diagnostics only.
    const issues = result.error.issues.map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.code}`);
    throw new Error(`Response JSON schema mismatch (HTTP ${status}): ${issues.join(', ')}`);
  }
  return result.data;
}
