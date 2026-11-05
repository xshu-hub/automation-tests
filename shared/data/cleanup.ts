type Cleanup = { name: string; action: () => Promise<unknown> | unknown };

/** Runs every cleanup in reverse creation order, including when one cleanup fails. */
export class CleanupStack {
  private readonly tasks: Cleanup[] = [];
  private disposing?: Promise<void>;

  defer(name: string, action: Cleanup['action']): void {
    this.tasks.push({ name, action });
  }

  dispose(): Promise<void> {
    // Concurrent callers must not start releasing parents while a child is pending.
    this.disposing ??= Promise.resolve().then(() => this.drain()).finally(() => { this.disposing = undefined; });
    return this.disposing;
  }

  private async drain(): Promise<void> {
    const errors: Error[] = [];
    while (this.tasks.length) {
      const task = this.tasks.pop()!;
      try {
        await task.action();
      } catch (cause) {
        errors.push(new Error(`Cleanup failed: ${task.name}`, { cause }));
      }
    }
    if (errors.length) throw new AggregateError(errors, `${errors.length} cleanup operation(s) failed.`);
  }
}
