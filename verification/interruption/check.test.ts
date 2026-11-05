import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once, EventEmitter } from 'node:events';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { initializeRun, repositoryRoot } from '../../shared/config/output';
import { forceStopTree, startManagedProcess } from '../../scripts/managed-process';
import { createTarget } from '../../scripts/create-target';

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}
async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
async function until<T>(read: () => Promise<T>, accept: (value: T) => boolean, description: string): Promise<T> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (accept(value)) return value;
    // Verification polls observable process/filesystem state; it does not delay business actions.
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(`Timed out observing ${description}`);
}
async function waitFile(file: string): Promise<void> {
  await until(async () => existsSync(file), Boolean, file);
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}
function ownedProcessSnapshot(root: number): { pid: number; parent: number; name: string }[] {
  let table: { pid: number; parent: number; name: string }[];
  if (process.platform === 'win32') {
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress'],
    { encoding: 'utf8', windowsHide: true, timeout: 10_000 });
    table = (JSON.parse(output) as { ProcessId: number; ParentProcessId: number; Name: string }[])
      .map(row => ({ pid: row.ProcessId, parent: row.ParentProcessId, name: row.Name }));
  } else {
    table = execFileSync('ps', ['-eo', 'pid=,ppid=,comm='], { encoding: 'utf8', timeout: 10_000 })
      .trim().split('\n').map(line => {
        const [pid, parent, ...name] = line.trim().split(/\s+/);
        return { pid: Number(pid), parent: Number(parent), name: name.join(' ') };
      });
  }
  const owned = new Set([root]);
  let count: number;
  do {
    count = owned.size;
    for (const row of table) if (owned.has(row.parent)) owned.add(row.pid);
  } while (owned.size !== count);
  return table.filter(row => owned.has(row.pid));
}
async function connectable(port: number): Promise<boolean> {
  try { await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) }); return true; }
  catch { return false; }
}

test('real managed child executes its SIGINT cleanup handler and returns the requested exit code', { timeout: 20_000 }, async () => {
  const directory = await mkdtemp(resolve(repositoryRoot, '.runtime-child-'));
  const marker = resolve(directory, 'cleanup');
  const signals = new EventEmitter();
  const { child, completed } = startManagedProcess(resolve(import.meta.dirname, 'process-child.mjs'), [marker], {
    signals, stdio: 'pipe', shutdownTimeoutMs: 5000,
  });
  try {
    await once(child.stdout!, 'data', { signal: AbortSignal.timeout(10_000) });
    signals.emit('SIGTERM');
    assert.equal(await completed, 143);
    assert.equal(await readFile(marker, 'utf8'), 'graceful child cleanup');
    assert.equal(alive(child.pid!), false);
  } finally { await forceStopTree(child); await rm(directory, { recursive: true, force: true }); }
});

test('IPC interruption is queued until a late SIGINT handler is installed', { timeout: 20_000 }, async () => {
  const directory = await mkdtemp(resolve(repositoryRoot, '.runtime-child-'));
  const marker = resolve(directory, 'cleanup');
  // Exercise the exact Windows bridge on every CI OS, without simulating kill().
  const child = spawn(process.execPath, ['--import', 'tsx', resolve(repositoryRoot, 'scripts/child-runner.ts'),
    resolve(import.meta.dirname, 'process-child.mjs'), marker], {
    cwd: repositoryRoot, env: { ...process.env, PROBE_DELAY_HANDLER: '1' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true, detached: true,
  });
  const exited = once(child, 'close');
  try {
    await once(child.stdout!, 'data', { signal: AbortSignal.timeout(10_000) });
    child.send({ type: 'automation:interrupt' });
    child.send({ type: 'probe:install-handler' });
    assert.equal((await exited)[0], 0);
    assert.equal(await readFile(marker, 'utf8'), 'graceful child cleanup');
  } finally { await forceStopTree(child); await rm(directory, { recursive: true, force: true }); }
});

for (const scenario of ['SIGINT', 'SIGTERM', 'deadline', 'second-interrupt'] as const) {
  test(`real Playwright interruption: ${scenario}`, { timeout: 40_000 }, async () => {
    const target = `interruption-${randomUUID().slice(0, 8)}`;
    const targetDirectory = await createTarget(target);
    await writeFile(resolve(targetDirectory, 'playwright.config.ts'),
      "export { default } from '../../verification/interruption/playwright.config';\n");
    const items = new Map<string, { id: string }>();
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      if (request.method === 'POST' && request.url === '/api/items') {
        const item = { id: randomUUID() }; items.set(item.id, item);
        response.writeHead(201); response.end(JSON.stringify(item));
      } else if (request.method === 'DELETE' && request.url?.startsWith('/api/items/')) {
        items.delete(request.url.slice('/api/items/'.length)); response.writeHead(204); response.end();
      } else { response.end(JSON.stringify([...items.values()])); }
    });
    const apiPort = await listen(server);
    const reservation = createServer();
    const webPort = await listen(reservation);
    await close(reservation);
    const runtimeRoot = resolve(repositoryRoot, '.runtime');
    await mkdir(runtimeRoot, { recursive: true });
    const directory = await mkdtemp(resolve(runtimeRoot, 'verify-interruption-'));
    const env = { ...process.env, AUTOMATION_RUN_ID: `verify-interruption-${randomUUID()}` };
    const { runID, attemptID } = initializeRun(env, true);
    const output = resolve(repositoryRoot, 'artifacts', target, 'verification', runID, attemptID);
    const proof = resolve(output, 'proof');
    await mkdir(proof, { recursive: true });
    const retainedMarker = resolve(output, 'previous-attempt-report.txt');
    await writeFile(retainedMarker, attemptID);
    const input = resolve(directory, 'input.json');
    await writeFile(input, JSON.stringify({ target, environment: 'verification',
      webBaseURL: `http://127.0.0.1:${webPort}`, apiBaseURL: `http://127.0.0.1:${apiPort}/api/`,
      defaultIdentity: 'anonymous', identities: {},
    }));
    const stalled = scenario === 'deadline' || scenario === 'second-interrupt';
    Object.assign(env, { AUTOMATION_INPUT: input, INTERRUPTION_WEB_PORT: String(webPort),
      INTERRUPTION_PROOF: proof, INTERRUPTION_TARGET: target, INTERRUPTION_STALL: stalled ? '1' : '0' });
    const child = spawn(process.execPath, ['--import', 'tsx', resolve(repositoryRoot, 'scripts/run.ts'),
      '--target', target, '--input', input, '--shutdown-timeout', scenario === 'deadline' ? '2000' : '15000'], {
      cwd: repositoryRoot, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true, detached: true,
    });
    const completed = once(child, 'close');
    let log = '';
    child.stdout!.on('data', data => { log += String(data); });
    child.stderr!.on('data', data => { log += String(data); });
    try {
      await waitFile(resolve(proof, 'test-ready.json'));
      const created = JSON.parse(await readFile(resolve(proof, 'test-ready.json'), 'utf8')) as { id: string; worker: number };
      const owned = JSON.parse(await readFile(resolve(proof, 'owned-processes.json'), 'utf8')) as { server: number; descendant: number };
      assert.ok(items.has(created.id), 'Test did not create real external data');
      const observedTree = ownedProcessSnapshot(child.pid!);
      assert.ok(observedTree.some(row => /chrome|chromium|headless/i.test(row.name)), 'No actual Chromium process observed');
      const first = scenario === 'SIGTERM' ? 'SIGTERM' : 'SIGINT';
      if (process.platform !== 'win32' && scenario === 'SIGTERM') child.kill('SIGTERM');
      else child.send({ type: 'automation:interrupt', signal: first });
      if (scenario === 'second-interrupt') {
        await waitFile(resolve(proof, 'cleanup-started'));
        child.send({ type: 'automation:interrupt', signal: 'SIGINT' });
      }
      assert.equal((await completed)[0], first === 'SIGINT' ? 130 : 143, log);
      // run.ts intentionally allocates a fresh attempt, so use its exact record.
      const launchDirectory = resolve(repositoryRoot, 'artifacts/_launcher', target, runID);
      const [launchAttempt] = await readdir(launchDirectory);
      const lifecycle = JSON.parse(await readFile(resolve(launchDirectory, launchAttempt, 'status.json'), 'utf8')) as {
        pid: number; forced: boolean; interruptedBy: string; exitCode: number; state: string;
      };
      assert.equal(lifecycle.forced, stalled);
      assert.equal(lifecycle.interruptedBy, first);
      assert.equal(lifecycle.state, 'exited');
      assert.equal(lifecycle.exitCode, first === 'SIGINT' ? 130 : 143);
      const pids = [...new Set([child.pid!, lifecycle.pid, created.worker, owned.server, owned.descendant,
        ...observedTree.map(row => row.pid)])];
      await until(async () => pids.filter(alive), pids => !pids.length, 'owned process tree exit');
      assert.equal(await connectable(webPort), false, 'Runner-owned web server is still listening');
      assert.equal(await readFile(retainedMarker, 'utf8'), attemptID, 'A prior attempt artifact was overwritten');
      const actualOutput = resolve(repositoryRoot, 'artifacts', target, 'verification', runID, launchAttempt);
      const files = await readdir(resolve(actualOutput, 'results'), { recursive: true });
      const partialProof = files.find(file => file.endsWith('before-interrupt.txt'));
      assert.ok(partialProof, 'Partial output from the interrupted attempt was removed');
      assert.equal(await readFile(resolve(actualOutput, 'results', partialProof), 'utf8'), created.id);
      if (stalled) {
        assert.equal(items.size, 1, 'Force-stop limitation probe must retain the deliberately blocked cleanup resource');
        assert.equal(existsSync(resolve(proof, 'cleanup-completed')), false);
      } else {
        assert.equal(items.size, 0, 'External API server survived but test data leaked');
        assert.equal(await readFile(resolve(proof, 'cleanup-completed'), 'utf8'), created.id);
        const report = JSON.parse(await readFile(resolve(actualOutput, 'results.json'), 'utf8')) as {
          suites: { specs: { tests: { results: { status: string }[] }[] }[] }[];
        };
        assert.equal(report.suites[0].specs[0].tests[0].results[0].status, 'interrupted');
        assert.ok((await stat(resolve(actualOutput, 'report/index.html'))).size > 0);
        assert.match(await readFile(resolve(actualOutput, 'junit.xml'), 'utf8'), /tests="1"/);
        assert.ok(files.some(file => file.endsWith('trace.zip')));
        assert.ok(files.some(file => file.endsWith('.png')));
      }
      await writeFile(resolve(proof, 'verification.json'), JSON.stringify({ scenario, externalResourcesAfterStop: items.size,
        ownedProcessesExited: pids, observedTree, webServerClosed: true, forced: stalled, priorAttemptPreserved: true,
        partialOutputPreserved: true, output: actualOutput }, null, 2));
      console.log(`Verified ${scenario}: ${actualOutput}`);
    } finally {
      await forceStopTree(child);
      // This API server belongs to the verifier, not the interrupted process.
      // Test-only emergency cleanup makes forced-stop tests repeatable without
      // falsely claiming the dead worker ran its cleanup fixture.
      items.clear();
      await writeFile(resolve(output, 'process.log'), log);
      await close(server);
      await rm(directory, { recursive: true, force: true });
      await rm(targetDirectory, { recursive: true, force: true });
    }
  });
}
