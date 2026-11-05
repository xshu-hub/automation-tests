import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import { waitForChild } from '../../scripts/launch';
import { repositoryRoot } from '../../shared/config/output';

class ControlledChild extends EventEmitter {
  pid = 123;
  killed = false;
  forwarded: NodeJS.Signals[] = [];

  kill(signal: NodeJS.Signals): boolean {
    this.killed = true;
    this.forwarded.push(signal);
    if (signal === 'SIGKILL') this.emit('close', null, signal);
    return true;
  }

  asChild(): ChildProcess { return this as unknown as ChildProcess; }
}

test('launcher preserves real success/failure exit codes and handles spawn failure', async () => {
  for (const code of [0, 37]) {
    const signals = new EventEmitter();
    const child = spawn(process.execPath, ['-e', `process.exit(${code})`], { stdio: 'ignore' });
    assert.equal(await waitForChild(child, { signals }), code);
    assert.equal(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM'), 0);
  }
  const errors: Error[] = [];
  const missing = spawn(resolve(repositoryRoot, 'nonexistent-launcher-executable'), [], { stdio: 'ignore' });
  assert.equal(await waitForChild(missing, { signals: new EventEmitter(), onError: (error) => errors.push(error) }), 1);
  assert.equal(errors.length, 1);
});

test('SIGTERM requests Playwright teardown, returns 143 and removes listeners', async () => {
  const child = new ControlledChild();
  const signals = new EventEmitter();
  const completed = waitForChild(child.asChild(), { signals });
  signals.emit('SIGTERM');
  assert.deepEqual(child.forwarded, ['SIGINT']);
  child.emit('close', 0, null);
  assert.equal(await completed, 143);
  assert.equal(signals.listenerCount('SIGINT') + signals.listenerCount('SIGTERM'), 0);
  assert.equal(child.listenerCount('error') + child.listenerCount('close'), 0);
});

test('a second interruption forces termination even after child.killed becomes true', async () => {
  const child = new ControlledChild();
  const signals = new EventEmitter();
  const completed = waitForChild(child.asChild(), { signals });
  signals.emit('SIGINT');
  assert.equal(child.killed, true);
  signals.emit('SIGTERM');
  assert.equal(await completed, 130);
  assert.deepEqual(child.forwarded, ['SIGINT', 'SIGKILL']);
});

test('a stalled teardown is forcibly stopped after the shutdown deadline', async () => {
  const child = new ControlledChild();
  const signals = new EventEmitter();
  const completed = waitForChild(child.asChild(), { signals, shutdownTimeoutMs: 20 });
  signals.emit('SIGTERM');
  assert.equal(await completed, 143);
  assert.deepEqual(child.forwarded, ['SIGINT', 'SIGKILL']);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('a failed cooperative interruption falls back to force stop without losing the requested exit code', async () => {
  const child = new ControlledChild();
  const signals = new EventEmitter();
  const errors: Error[] = [];
  const completed = waitForChild(child.asChild(), { signals,
    requestInterrupt: async () => { throw new Error('IPC disconnected'); },
    onError: error => errors.push(error),
  });
  signals.emit('SIGTERM');
  assert.equal(await completed, 143);
  assert.deepEqual(child.forwarded, ['SIGKILL']);
  assert.equal(errors[0].message, 'IPC disconnected');
});

test('root exit does not finish the launcher before asynchronous tree termination completes', async () => {
  const child = new ControlledChild();
  const signals = new EventEmitter();
  let release = () => {};
  const treeStopped = new Promise<void>(resolve => { release = resolve; });
  let finished = false;
  const completed = waitForChild(child.asChild(), { signals,
    forceStop: () => { child.emit('close', 0, null); return treeStopped; },
  }).then(code => { finished = true; return code; });
  signals.emit('SIGINT');
  signals.emit('SIGINT');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false);
  release();
  assert.equal(await completed, 130);
});

test('CLI passes native Playwright flags after the separator without requiring runtime state', () => {
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', resolve(repositoryRoot, 'scripts/run.ts'), '--target', 'demo', '--suite', 'api', '--', '--help',
  ], { cwd: repositoryRoot, encoding: 'utf8', env: { ...process.env, AUTOMATION_RUN_ID: 'cli-help-probe' } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /target=demo suite=api/);
  assert.match(result.stdout, /--workers/);
});

test('CLI keeps positional spec filters separate from the selected project', () => {
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', resolve(repositoryRoot, 'scripts/run.ts'), '--target', 'demo', '--suite', 'web',
    '--', 'foundation.spec.ts', '--list',
  ], { cwd: repositoryRoot, encoding: 'utf8', env: { ...process.env, AUTOMATION_INPUT: resolve(repositoryRoot, 'examples/demo.input.json') } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[web\].*foundation\.spec\.ts/);
  assert.doesNotMatch(result.stdout, /\[api\]/);
});
