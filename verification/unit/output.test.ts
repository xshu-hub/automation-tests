import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { defineTarget } from '../../shared/config/define-target';
import { initializeRun, repositoryRoot, resolveArtifactOutput, validateTargetID } from '../../shared/config/output';

test('artifact identifiers reject traversal and Windows reserved directory names', () => {
  for (const value of ['../escape', '..\\escape', '/tmp/escape', 'C:\\escape', '', 'con']) {
    assert.throws(() => initializeRun({ AUTOMATION_RUN_ID: value }), /AUTOMATION_RUN_ID/);
    assert.throws(() => initializeRun({ AUTOMATION_ATTEMPT_ID: value }), /AUTOMATION_ATTEMPT_ID/);
    assert.throws(() => validateTargetID(value), /Target ID/);
  }
  assert.throws(() => resolveArtifactOutput('demo', '../outside', {}), /Environment/);
});

test('independent launches in one batch have isolated output and workers reuse the attempt', () => {
  const firstEnv = { AUTOMATION_RUN_ID: 'shared-batch' };
  const secondEnv = { AUTOMATION_RUN_ID: 'shared-batch' };
  const first = resolveArtifactOutput('demo', 'test', firstEnv);
  const second = resolveArtifactOutput('demo', 'test', secondEnv);
  assert.notEqual(first.artifactDirectory, second.artifactDirectory);
  assert.equal(first.runID, second.runID);
  assert.deepEqual(resolveArtifactOutput('demo', 'test', { ...firstEnv }), first);
  assert.equal(first.artifactDirectory, resolve(repositoryRoot, 'artifacts/demo/test/shared-batch', first.attemptID));
  assert.notEqual(initializeRun(firstEnv, true).attemptID, first.attemptID);
});

test('target config exposes the exact isolated directory for every native reporter', () => {
  const keys = ['AUTOMATION_INPUT', 'AUTOMATION_RUN_ID', 'AUTOMATION_ATTEMPT_ID'] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.AUTOMATION_INPUT = resolve(repositoryRoot, 'examples/demo.input.json');
    process.env.AUTOMATION_RUN_ID = 'config-probe';
    delete process.env.AUTOMATION_ATTEMPT_ID;
    const options = { id: 'demo', directory: resolve(repositoryRoot, 'targets/demo') };
    const config = defineTarget(options);
    const reloaded = defineTarget(options);
    const directory = config.metadata?.artifactDirectory as string;
    assert.equal(config.metadata?.runID, 'config-probe');
    assert.equal(config.metadata?.attemptID, process.env.AUTOMATION_ATTEMPT_ID);
    assert.deepEqual(reloaded.metadata, config.metadata);
    assert.equal(config.outputDir, resolve(directory, 'results'));
    assert.deepEqual(config.reporter, [
      ['list'],
      ['html', { outputFolder: resolve(directory, 'report'), open: 'never' }],
      ['junit', { outputFile: resolve(directory, 'junit.xml') }],
      ['json', { outputFile: resolve(directory, 'results.json') }],
    ]);
    assert.equal(config.workers, 2);
    assert.equal(config.use?.browserName, 'chromium');
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
