export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue | readonly QueryValue[]>;

/** Preserve the caller's relative/root-relative/absolute path; undefined leaves a key unchanged. */
export function withQuery(path: string, query: Query = {}): string {
  const hashAt = path.indexOf('#');
  const hash = hashAt < 0 ? '' : path.slice(hashAt);
  const withoutHash = hashAt < 0 ? path : path.slice(0, hashAt);
  const queryAt = withoutHash.indexOf('?');
  const pathname = queryAt < 0 ? withoutHash : withoutHash.slice(0, queryAt);
  const params = new URLSearchParams(queryAt < 0 ? '' : withoutHash.slice(queryAt + 1));
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.delete(key);
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (entry !== undefined && entry !== null) params.append(key, String(entry));
    }
  }
  const search = params.toString();
  return `${pathname}${search ? `?${search}` : ''}${hash}`;
}

/** Standard URL semantics: `items` preserves a trailing-slash base path; `/items` starts at the origin. */
export function resolveURL(path: string, baseURL: string, query?: Query): URL {
  return new URL(withQuery(path, query), baseURL);
}
