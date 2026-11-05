import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { repositoryRoot } from '../shared/config/output';
import { waitForChild } from './launch';

export type ProcessOptions = { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: 'inherit' | 'pipe' | 'ignore'; lifecycleFile?: string }
  & Parameters<typeof waitForChild>[1];

/** Force only the tree rooted at this live, owned child; never kill by image name. */
export async function forceStopTree(child: ChildProcess): Promise<void> {
  if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform !== 'win32') {
    // Playwright's browser/webServer can start their own groups. Killing only
    // the CLI group would miss those owned descendants on POSIX.
    const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,pgid='], { encoding: 'utf8', timeout: 5000 })
      .trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
    const owned = new Set([child.pid]);
    let count: number;
    do {
      count = owned.size;
      for (const [pid, parent] of rows) if (owned.has(parent)) owned.add(pid);
    } while (owned.size !== count);
    const groups = new Set(rows.filter(([pid]) => owned.has(pid)).map(([, , group]) => group));
    if (!groups.has(child.pid) || groups.has(process.pid)) {
      throw new Error('Refusing to force stop a child without its isolated process group.');
    }
    for (const group of [...groups].reverse()) {
      try { process.kill(-group, 'SIGKILL'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
    }
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true, stdio: 'ignore',
      timeout: 10_000, killSignal: 'SIGKILL',
    });
    killer.once('error', reject);
    killer.once('close', (code) => {
      if (code === 0 || child.exitCode !== null || child.signalCode !== null) resolve();
      else reject(new Error(`Could not terminate owned process tree (taskkill exit ${code}).`));
    });
  });
}

/** An owned process group/tree; Windows uses IPC, POSIX keeps native SIGINT delivery. */
export function startManagedProcess(entry: string, args: string[], options: ProcessOptions = {}): {
  child: ChildProcess; completed: Promise<number>;
} {
  const windows = process.platform === 'win32';
  const argv = windows
    ? ['--import', 'tsx', resolve(repositoryRoot, 'scripts/child-runner.ts'), entry, ...args]
    : [entry, ...args];
  const stdio = options.stdio ?? 'inherit';
  // Managed callers may capture stdout/stderr while preserving the private channel.
  const streams = [stdio, stdio, stdio] as const;
  const child = spawn(process.execPath, argv, {
    cwd: options.cwd ?? repositoryRoot, env: options.env,
    stdio: windows ? [...streams, 'ipc'] : stdio,
    detached: true, windowsHide: true,
  });
  const onError = options.onError ?? ((error: Error) => console.error(error.message));
  const status = { pid: child.pid, startedAt: new Date().toISOString(), state: 'running',
    interruptedBy: null as 'SIGINT' | 'SIGTERM' | null, forced: false, exitCode: null as number | null,
    terminationError: null as string | null };
  const persist = (state: string) => {
    status.state = state;
    if (!options.lifecycleFile) return;
    try {
      mkdirSync(dirname(options.lifecycleFile), { recursive: true });
      const temporary = `${options.lifecycleFile}.tmp`;
      writeFileSync(temporary, JSON.stringify(status, null, 2));
      renameSync(temporary, options.lifecycleFile);
    } catch (error) { onError(error instanceof Error ? error : new Error(String(error))); }
  };
  persist('running');
  const requestInterrupt = (signal: 'SIGINT' | 'SIGTERM') => {
    status.interruptedBy = signal;
    persist('interrupting');
    if (options.requestInterrupt) return options.requestInterrupt(signal);
    if (!windows) { child.kill('SIGINT'); return; }
    return new Promise<void>((resolve, reject) => {
      if (!child.connected) { reject(new Error('Managed child IPC is disconnected.')); return; }
      child.send({ type: 'automation:interrupt' }, (error) => error ? reject(error) : resolve());
    });
  };
  const completed = waitForChild(child, {
    ...options, requestInterrupt,
    forceStop: async () => {
      status.forced = true;
      persist('forcing');
      console.error('[automation] Forcing owned test processes to stop; data cleanup and final reports may be incomplete.');
      try { await (options.forceStop ? options.forceStop() : forceStopTree(child)); }
      catch (error) {
        status.terminationError = error instanceof Error ? error.message : String(error);
        persist('force-failed');
        throw error;
      }
    },
  }).then(code => { status.exitCode = code; persist('exited'); return code; });
  return { child, completed };
}
