import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResourceScope } from '../../shared/sessions/resource-scope';

test('session cleanup runs before reverse-order releases, and failures do not leak remaining resources', async () => {
  const scope = new ResourceScope();
  const order: string[] = [];
  await scope.create('first', async own => own(async () => { order.push('close first'); }));
  await scope.create('second', async own => own(async () => { order.push('close second'); throw new Error('close failure'); }));
  scope.cleanup.defer('business', () => { order.push('business'); throw new Error('cleanup failure'); });
  await assert.rejects(scope.dispose(), AggregateError);
  assert.deepEqual(order, ['business', 'close second', 'close first']);
  await assert.rejects(scope.dispose(), AggregateError);
  assert.equal(order.length, 3);
  assert.throws(() => scope.create('late', async () => {}), /closed/);
});

test('concurrent duplicate names are rejected before allocation and pending resources are owned at shutdown', async () => {
  const scope = new ResourceScope();
  let finish = () => {};
  const gate = new Promise<void>(resolve => { finish = resolve; });
  let closed = false;
  const creating = scope.create('pending', async own => {
    await gate;
    own(async () => { closed = true; });
  });
  assert.throws(() => scope.create('pending', async () => {}), /already exists/);
  const disposing = scope.dispose();
  finish();
  await creating;
  await disposing;
  assert.equal(closed, true);
});

test('partially initialized session resources are released even when creation fails', async () => {
  const scope = new ResourceScope();
  let closed = false;
  await assert.rejects(scope.create('partial', async own => {
    own(async () => { closed = true; });
    throw new Error('initialization failure');
  }), /initialization failure/);
  await scope.dispose();
  assert.equal(closed, true);
  assert.throws(() => new ResourceScope().create('../path', async () => {}), /session name/);
});
