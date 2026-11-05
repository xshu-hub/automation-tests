import { CleanupStack } from '../data/cleanup';

/** Owns asynchronous creations, business cleanup and resource releases for one test. */
export class ResourceScope {
  readonly cleanup = new CleanupStack();
  private readonly releases = new CleanupStack();
  private readonly names = new Set<string>();
  private readonly pending = new Set<Promise<unknown>>();
  private closing = false;
  private disposed?: Promise<void>;

  create<T>(name: string, factory: (own: (release: () => Promise<unknown>) => void) => Promise<T>): Promise<T> {
    if (this.closing) throw new Error('Session scope is closed.');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(name)) throw new Error('Use a short session name containing letters, numbers, hyphens or underscores.');
    if (this.names.has(name)) throw new Error(`Session "${name}" already exists; keep and reuse the returned session.`);
    this.names.add(name);
    // Reserve synchronously so concurrent callers cannot allocate the same name twice.
    const result = Promise.resolve().then(() => factory(release => this.releases.defer(name, release)));
    this.pending.add(result);
    void result.then(() => this.pending.delete(result), () => this.pending.delete(result));
    return result;
  }

  dispose(): Promise<void> {
    if (this.disposed) return this.disposed;
    this.closing = true;
    this.disposed = (async () => {
      // Creations register ownership before returning, including when initialization fails.
      await Promise.allSettled([...this.pending]);
      const errors: unknown[] = [];
      try { await this.cleanup.dispose(); } catch (error) { errors.push(error); }
      try { await this.releases.dispose(); } catch (error) { errors.push(error); }
      if (errors.length) throw new AggregateError(errors, 'Session cleanup or resource release failed.');
    })();
    return this.disposed;
  }
}
