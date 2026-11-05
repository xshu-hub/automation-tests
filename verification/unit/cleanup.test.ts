import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CleanupStack } from '../../shared/data/cleanup';

test('cleanup reverses creation order and still runs remaining actions after failure', async () => {
  const order: string[] = [];
  const stack = new CleanupStack();
  stack.defer('parent', () => { order.push('parent'); });
  stack.defer('child', () => { order.push('child'); throw new Error('cleanup failed'); });
  stack.defer('grandchild', () => { order.push('grandchild'); });
  await assert.rejects(stack.dispose(), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 1);
    return true;
  });
  assert.deepEqual(order, ['grandchild', 'child', 'parent']);
  await stack.dispose();
  assert.deepEqual(order, ['grandchild', 'child', 'parent']);
});

test('concurrent disposal waits for dependent cleanup before releasing its parent', async () => {
  const stack = new CleanupStack();
  const order: string[] = [];
  let finish = () => {};
  let started = () => {};
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  stack.defer('parent', () => { order.push('parent'); });
  stack.defer('child', async () => { started(); await gate; order.push('child'); });
  const first = stack.dispose();
  await entered;
  const second = stack.dispose();
  try { assert.deepEqual(order, []); }
  finally { finish(); await Promise.all([first, second]); }
  assert.deepEqual(order, ['child', 'parent']);
});
