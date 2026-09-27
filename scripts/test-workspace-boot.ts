import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const middleware = read('../apps/dashboard/src/middleware.ts');
const layout = read('../apps/dashboard/src/app/layout.tsx');
const workspaceAccess = read('../apps/dashboard/src/components/workspace-access.tsx');
const overview = read('../apps/dashboard/src/app/page.tsx');
const tenant = read('../apps/dashboard/src/lib/tenant.ts');

assert.match(middleware, /!req\.auth\?\.user\?\.id/);
assert.match(middleware, /NextResponse\.redirect\(new URL\('\/login'/);
assert.match(layout, /resolveServerWorkspace\(\)/);
assert.match(layout, /redirect\('\/login'\)/);
assert.doesNotMatch(workspaceAccess, /Opening your property/);
assert.doesNotMatch(workspaceAccess, /fetch\('\/api\/me'/);
assert.doesNotMatch(overview, /fetch\('\/api\/me'/);
assert.match(tenant, /Promise\.all\(\[/);
assert.doesNotMatch(workspaceAccess, /Amami/i);
assert.doesNotMatch(workspaceAccess, /demo property/i);

console.log('server-routed workspace boot regression tests: PASS');
