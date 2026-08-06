// @ts-nocheck
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'vitest';

import {
  closeDatabase,
  getConversation,
  insertConversation,
  insertProject,
  listMessages,
  openDatabase,
  upsertMessage,
} from '../src/db.js';

const tempDirs = [];

afterEach(() => {
  closeDatabase();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-upsert-own-'));
  tempDirs.push(dir);
  return openDatabase(dir, { dataDir: path.join(dir, '.od') });
}

test('upsertMessage refuses to rewrite a message owned by another conversation', () => {
  const db = createDb();
  insertProject(db, { id: 'p1', name: 'P', createdAt: 1, updatedAt: 1 });
  insertConversation(db, {
    id: 'cA',
    projectId: 'p1',
    title: 'A',
    createdAt: 1,
    updatedAt: 1,
  });
  insertConversation(db, {
    id: 'cB',
    projectId: 'p1',
    title: 'B',
    createdAt: 2,
    updatedAt: 2,
  });

  upsertMessage(db, 'cA', {
    id: 'm1',
    role: 'assistant',
    content: 'secret-from-A',
    events: [{ kind: 'text', text: 'hi' }],
  });

  assert.throws(
    () =>
      upsertMessage(db, 'cB', {
        id: 'm1',
        role: 'assistant',
        content: 'CORRUPTED',
      }),
    /conversation/,
  );

  const messagesA = listMessages(db, 'cA');
  assert.equal(messagesA.length, 1);
  assert.equal(messagesA[0].content, 'secret-from-A');
  assert.deepEqual(messagesA[0].events, [{ kind: 'text', text: 'hi' }]);
  assert.equal(listMessages(db, 'cB').length, 0);

  // Target conversation activity must not be bumped on the rejected write.
  assert.equal(getConversation(db, 'cB')?.updatedAt, 2);
});

test('upsertMessage still updates when the conversation owns the message', () => {
  const db = createDb();
  insertProject(db, { id: 'p1', name: 'P', createdAt: 1, updatedAt: 1 });
  insertConversation(db, {
    id: 'cA',
    projectId: 'p1',
    title: 'A',
    createdAt: 1,
    updatedAt: 1,
  });

  upsertMessage(db, 'cA', {
    id: 'm1',
    role: 'assistant',
    content: 'draft',
    events: [],
  });
  const saved = upsertMessage(db, 'cA', {
    id: 'm1',
    role: 'assistant',
    content: 'final',
    events: [{ kind: 'text', text: 'done' }],
    runStatus: 'succeeded',
  });

  assert.equal(saved?.content, 'final');
  assert.equal(saved?.runStatus, 'succeeded');
  assert.deepEqual(listMessages(db, 'cA')[0].events, [{ kind: 'text', text: 'done' }]);
});
