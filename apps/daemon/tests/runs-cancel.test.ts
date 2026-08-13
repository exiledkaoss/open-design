// @ts-nocheck
import assert from 'node:assert/strict';
import { test } from 'vitest';

import { createChatRunService } from '../src/runs.js';

function createService() {
  return createChatRunService({
    createSseResponse() {
      return { send() {}, end() {}, cleanup() {} };
    },
    createSseErrorPayload(code, message) {
      return { code, message };
    },
  });
}

test('cancelAllActive SIGTERMs spawned children and finishes childless runs', () => {
  const service = createService();

  const running = service.create();
  running.status = 'running';
  const signals: string[] = [];
  running.child = {
    killed: false,
    kill(signal) {
      signals.push(signal);
      this.killed = true;
    },
  };

  const queued = service.create();
  const succeeded = service.create();
  service.finish(succeeded, 'succeeded', 0, null);

  service.cancelAllActive();

  assert.deepEqual(signals, ['SIGTERM']);
  assert.equal(running.cancelRequested, true);
  assert.equal(running.status, 'running');
  assert.equal(queued.status, 'canceled');
  assert.equal(succeeded.status, 'succeeded');
});

test('cancelAllActive is a no-op when every run is already terminal', () => {
  const service = createService();
  const run = service.create();
  service.finish(run, 'failed', 1, null);
  service.cancelAllActive();
  assert.equal(run.status, 'failed');
  assert.equal(run.cancelRequested, false);
});
