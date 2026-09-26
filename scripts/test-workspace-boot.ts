import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyWorkspaceFailure, classifyWorkspaceResponse } from '../apps/dashboard/src/lib/workspace-boot';

assert.equal(classifyWorkspaceResponse(401, false), 'unauthenticated');
assert.equal(classifyWorkspaceResponse(403, false), 'authenticated_no_access');
assert.equal(classifyWorkspaceResponse(500, false), 'server_error');
assert.equal(classifyWorkspaceResponse(200, false), 'authenticated_no_property');
assert.equal(classifyWorkspaceResponse(200, true), 'authenticated_ready');
assert.equal(classifyWorkspaceFailure(), 'network_error');

const workspaceSource = readFileSync(
  new URL('../apps/dashboard/src/components/workspace-access.tsx', import.meta.url),
  'utf8',
);
const overviewSource = readFileSync(
  new URL('../apps/dashboard/src/app/page.tsx', import.meta.url),
  'utf8',
);

assert.equal((workspaceSource.match(/fetch\('\/api\/me'/g) || []).length, 1);
assert.equal((overviewSource.match(/fetch\('\/api\/me'/g) || []).length, 0);
assert.doesNotMatch(workspaceSource, /Your property could not be loaded/);
assert.match(workspaceSource, /response\.status === 401/);
assert.match(workspaceSource, /router\.replace\('\/login'\)/);

console.log('workspace boot regression tests: PASS');
