import { spawnSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { repositoryRoot } from '../shared/config/define-target';
import { validateFailureReport, type ProbeReport } from './failure-report';

const runID = `verify-failure-${randomUUID().slice(0, 8)}`;
const attemptID = randomUUID();
const result = spawnSync(process.execPath, [
  resolve(repositoryRoot, 'node_modules/@playwright/test/cli.js'), 'test',
  '--config', resolve(import.meta.dirname, 'failure.config.ts'),
], {
  cwd: repositoryRoot,
  env: { ...process.env, AUTOMATION_INPUT: resolve(repositoryRoot, 'examples/demo.input.json'),
    AUTOMATION_IDENTITY: process.env.FAILURE_PROBE_IDENTITY || 'admin',
    AUTOMATION_RUN_ID: runID, AUTOMATION_ATTEMPT_ID: attemptID },
  stdio: 'inherit',
});
assert.equal(result.status, 1, 'Exactly one deliberate failure should make Playwright exit with code 1.');
const output = resolve(repositoryRoot, 'artifacts/demo/local', runID, attemptID);
const report = JSON.parse(await readFile(resolve(output, 'results.json'), 'utf8')) as ProbeReport;
const { failure, cleanup } = validateFailureReport(report);
const proof = async (result: typeof failure, name: string): Promise<Record<string, unknown>> => {
  const attachment = result.attachments.find((entry) => entry.name === name)!;
  return JSON.parse(await readFile(attachment.path!, 'utf8')) as Record<string, unknown>;
};
const created = await proof(failure, 'created-item');
const removed = await proof(failure, 'cleanup-verified');
assert.ok(typeof created.id === 'string' && created.id.length > 0, 'No resource was actually created.');
assert.equal(removed.id, created.id, 'Cleanup proof refers to a different resource.');
assert.equal(removed.removed, true);
assert.equal((await proof(cleanup, 'post-cleanup-verified')).remaining, 0);
const sessionsProof = await proof(failure, 'sessions-cleanup-verified');
assert.equal(sessionsProof.apiAlive, true);
assert.equal(sessionsProof.pageAlive, true);
assert.ok(failure.attachments.filter(attachment => attachment.name === 'screenshot').length >= 2,
  'The default and named browser pages must both have native failure screenshots.');
const entries = await readdir(output, { recursive: true });
assert.ok(entries.some((file) => file.endsWith('.png')), 'Failure screenshot missing');
assert.ok(entries.some((file) => file.endsWith('trace.zip')), 'Failure trace missing');
assert.ok((await stat(resolve(output, 'report/index.html'))).size > 0, 'HTML report missing');
const junit = await readFile(resolve(output, 'junit.xml'), 'utf8');
assert.match(junit, /failures="1"/);
assert.match(junit, /tests="2"/);
console.log('Verified: exact intentional assertion, created resource, completed cleanup, screenshot, trace, and JSON/HTML/JUnit.');
