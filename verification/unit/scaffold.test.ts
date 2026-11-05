import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createTarget } from '../../scripts/create-target';
import { repositoryRoot } from '../../shared/config/output';

async function fixture(t: TestContext): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'automation-scaffold-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(resolve(repositoryRoot, 'templates'), resolve(root, 'templates'), { recursive: true });
  return root;
}

test('concurrent generators reserve a target once and produce a usable substituted template', async (t) => {
  const root = await fixture(t);
  const outcomes = await Promise.allSettled([createTarget('crm', root), createTarget('crm', root)]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = outcomes.find((result) => result.status === 'rejected');
  assert.ok(rejected?.status === 'rejected');
  assert.match(String(rejected.reason), /already exists/);
  const destination = resolve(root, 'targets/crm');
  assert.match(await readFile(resolve(destination, 'playwright.config.ts'), 'utf8'), /id: 'crm'/);
  assert.match(await readFile(resolve(destination, 'README.md'), 'utf8'), /--target crm/);
  assert.equal(JSON.parse(await readFile(resolve(destination, 'runtime.input.example.json'), 'utf8')).target, 'crm');
  assert.equal(JSON.parse(await readFile(resolve(destination, 'runtime.multi-system.input.example.json'), 'utf8')).target, 'crm');
  for (const directory of ['tests/api', 'tests/web', 'fixtures', 'pages', 'api', 'test-data', 'specs']) {
    assert.ok((await stat(resolve(destination, directory))).isDirectory());
  }
});

test('an existing target is never overwritten', async (t) => {
  const root = await fixture(t);
  const destination = resolve(root, 'targets/crm');
  await mkdir(destination, { recursive: true });
  await writeFile(resolve(destination, 'playwright.config.ts'), 'existing business configuration');
  await assert.rejects(createTarget('crm', root), /already exists/);
  assert.equal(await readFile(resolve(destination, 'playwright.config.ts'), 'utf8'), 'existing business configuration');
});

test('failed generation removes its own partial target and invalid IDs cannot escape targets', async (t) => {
  const root = await fixture(t);
  await rm(resolve(root, 'templates'), { recursive: true });
  await assert.rejects(createTarget('crm', root), { code: 'ENOENT' });
  await assert.rejects(stat(resolve(root, 'targets/crm')), { code: 'ENOENT' });
  for (const id of ['../outside', '..\\outside', 'con']) {
    await assert.rejects(createTarget(id, root), /Target ID/);
  }
});
