const test = require('node:test');
const assert = require('node:assert/strict');

const { generateQueueTokenNumber, calculateEstimatedWait, getStatusTone, getQueueStats } = require('../utils/queue');

test('generateQueueTokenNumber builds a queue token with a prefix and padded number', () => {
  assert.equal(generateQueueTokenNumber('A', 1), 'A001');
  assert.equal(generateQueueTokenNumber('Q', 12), 'Q012');
});

test('calculateEstimatedWait multiplies people ahead by average service time', () => {
  assert.equal(calculateEstimatedWait(6, 4), 24);
  assert.equal(calculateEstimatedWait(0, 5), 0);
});

test('getStatusTone maps token states to UI styles', () => {
  assert.equal(getStatusTone('WAITING'), 'warning');
  assert.equal(getStatusTone('SERVING'), 'primary');
  assert.equal(getStatusTone('COMPLETED'), 'success');
  assert.equal(getStatusTone('SKIPPED'), 'danger');
});

test('getQueueStats aggregates queue health for admin monitoring', () => {
  const stats = getQueueStats([
    { status: 'WAITING' },
    { status: 'WAITING' },
    { status: 'SERVING' },
    { status: 'COMPLETED' },
    { status: 'SKIPPED' }
  ]);

  assert.deepEqual(stats, {
    total: 5,
    waiting: 2,
    serving: 1,
    completed: 1,
    skipped: 1,
    nextToken: 'WAITING',
    summary: '2 waiting • 1 serving • 1 completed • 1 skipped'
  });
});
