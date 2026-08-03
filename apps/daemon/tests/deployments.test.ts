// @ts-nocheck
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'vitest';

import {
  closeDatabase,
  getDeploymentById,
  insertProject,
  openDatabase,
  updateDeploymentLinkStatus,
  upsertDeployment,
} from '../src/db.js';

const tempDirs = [];

afterEach(() => {
  closeDatabase();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'od-deployments-'));
  tempDirs.push(dir);
  return openDatabase(dir, { dataDir: path.join(dir, '.od') });
}

function seedDeployment(db, overrides = {}) {
  insertProject(db, {
    id: 'project-a',
    name: 'Project A',
    createdAt: 1,
    updatedAt: 1,
  });
  return upsertDeployment(db, {
    id: 'dep-row-1',
    projectId: 'project-a',
    fileName: 'page.html',
    providerId: 'vercel-self',
    url: 'https://old.example.vercel.app',
    deploymentId: 'vercel-old',
    deploymentCount: 1,
    target: 'preview',
    status: 'link-delayed',
    statusMessage: 'Vercel is still preparing the public link.',
    reachableAt: null,
    createdAt: 10,
    updatedAt: 10,
    ...overrides,
  });
}

test('updateDeploymentLinkStatus patches status without touching url fields', () => {
  const db = createDb();
  const prior = seedDeployment(db);

  const next = updateDeploymentLinkStatus(db, {
    projectId: prior.projectId,
    id: prior.id,
    expectedUrl: prior.url,
    status: 'ready',
    statusMessage: 'Public link is ready.',
    reachableAt: 99,
    updatedAt: 100,
  });

  assert.ok(next);
  assert.equal(next.url, 'https://old.example.vercel.app');
  assert.equal(next.deploymentId, 'vercel-old');
  assert.equal(next.deploymentCount, 1);
  assert.equal(next.status, 'ready');
  assert.equal(next.statusMessage, 'Public link is ready.');
  assert.equal(next.reachableAt, 99);
  assert.equal(next.updatedAt, 100);
});

test('stale check-link cannot revert url after concurrent redeploy', () => {
  const db = createDb();
  const prior = seedDeployment(db);

  // Redeploy finishes while check-link is still awaiting the old URL.
  const redeployed = upsertDeployment(db, {
    id: prior.id,
    projectId: prior.projectId,
    fileName: prior.fileName,
    providerId: prior.providerId,
    url: 'https://new.example.vercel.app',
    deploymentId: 'vercel-new',
    deploymentCount: 2,
    target: 'preview',
    status: 'link-delayed',
    statusMessage: 'Vercel is still preparing the public link.',
    reachableAt: null,
    createdAt: prior.createdAt,
    updatedAt: 50,
  });
  assert.equal(redeployed.url, 'https://new.example.vercel.app');
  assert.equal(redeployed.deploymentId, 'vercel-new');
  assert.equal(redeployed.deploymentCount, 2);

  // Stale check-link completes against the pre-redeploy snapshot.
  const stale = updateDeploymentLinkStatus(db, {
    projectId: prior.projectId,
    id: prior.id,
    expectedUrl: prior.url,
    status: 'ready',
    statusMessage: 'Public link is ready.',
    reachableAt: 60,
    updatedAt: 60,
  });
  assert.equal(stale, null);

  const current = getDeploymentById(db, prior.projectId, prior.id);
  assert.ok(current);
  assert.equal(current.url, 'https://new.example.vercel.app');
  assert.equal(current.deploymentId, 'vercel-new');
  assert.equal(current.deploymentCount, 2);
  assert.equal(current.status, 'link-delayed');
  assert.equal(current.reachableAt, undefined);
});
