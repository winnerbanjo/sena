import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';
requireIsolatedTestDatabase();
const base = process.env.SENA_TEST_APP_URL || 'http://localhost:3101';
if (!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('HTTP QA must use a local application.');
const fixture = JSON.parse(readFileSync('/tmp/sena-craft-fixture.json', 'utf8'));
const cookies = new Map<string,string>();
async function request(path: string, options: RequestInit = {}) {
 const response = await fetch(base + path, { ...options, headers: { Cookie: [...cookies].map(([k,v])=>`${k}=${v}`).join('; '), ...options.headers }, redirect:'manual' });
 for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'); const at=pair.indexOf('='); cookies.set(pair.slice(0,at),pair.slice(at+1)); }
 return response;
}
let count = 0;
function pass(name:string) { console.log('PASS '+name);count++; }
async function run() {
 const csrf = await (await request('/api/auth/csrf')).json();
 const login = await request('/api/auth/callback/credentials', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'}, body:new URLSearchParams({ csrfToken:csrf.csrfToken, email:fixture.email, password:fixture.password, callbackUrl:base }) });
 assert.equal(login.status,200);
 const me = await (await request('/api/me')).json(); assert.equal(me.property.id,fixture.propertyId); pass('credential login resolves the fixture property');
 const spoof = await (await request('/api/me?propertyId='+fixture.otherPropertyId+'&email=another@example.invalid',{ headers:{'x-property-id':fixture.otherPropertyId,'x-user-email':'another@example.invalid'} })).json(); assert.equal(spoof.property.id,fixture.propertyId); pass('identity headers and parameters cannot change tenant');
 for (const route of ['reservations','calendar','rooms','guests','payments','housekeeping','invoices','staff','subscription','website','connect/keys','connect/webhooks','connect/logs']) {
  const response=await request('/api/'+route); assert.equal(response.status,200,route); pass('owner can load '+route);
 }
 const cross = await request('/api/housekeeping',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({roomId:fixture.otherRoomId,status:'clean'})}); assert.equal(cross.status,404); pass('cross-tenant housekeeping mutation rejected');
 const { db, propertyMembers, users, eq, and }=await import('../packages/database/src/index');
 const where=and(eq(propertyMembers.userId,fixture.ownerId),eq(propertyMembers.propertyId,fixture.propertyId));
 try {
  await db.update(propertyMembers).set({role:'front_desk'}).where(where);
  assert.equal((await request('/api/connect/keys')).status,403); assert.equal((await request('/api/staff')).status,403); assert.equal((await request('/api/reservations')).status,200); pass('role downgrade overrides stale owner JWT');
  await db.update(propertyMembers).set({role:'housekeeping'}).where(where);
  assert.equal((await request('/api/reservations')).status,403); assert.equal((await request('/api/housekeeping')).status,200); assert.equal((await request('/api/rooms')).status,200); pass('housekeeping role is restricted to permitted data');
  await db.update(propertyMembers).set({permissions:['status:revoked']}).where(where);
  assert.equal((await request('/api/rooms')).status,403); pass('revoked membership cannot reuse session');
  await db.update(propertyMembers).set({role:'owner',permissions:[]}).where(where);
  await db.update(users).set({isActive:false}).where(eq(users.id,fixture.ownerId));
  assert.equal((await request('/api/me')).status,401); pass('disabled account cannot reuse session');
 } finally { await db.update(propertyMembers).set({role:'owner',permissions:[]}).where(where); await db.update(users).set({isActive:true}).where(eq(users.id,fixture.ownerId)); }
 const saved=await request('/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...me.property,name:'Sena Local QA A — saved'})}); assert.equal(saved.status,200);assert.equal((await (await request('/api/me')).json()).property.name,'Sena Local QA A — saved');pass('settings persist on a fresh server read');
 await request('/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(me.property)});
 const {propertyInvoices,properties}=await import('../packages/database/src/index');
 assert.equal((await request('/api/rooms?id='+fixture.roomTypeId+'&type=category',{method:'DELETE'})).status,409);pass('category deletion preserves existing rooms and reservation history');
 assert.equal((await request('/api/rooms?id='+fixture.roomId,{method:'DELETE'})).status,409);pass('room deletion preserves operational history');
 const onboarding=await request('/api/onboarding',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Do not overwrite',roomCategories:[]})});assert.equal(onboarding.status,409);assert.equal((await db.query.properties.findFirst({where:eq(properties.id,fixture.propertyId)}))?.name,me.property.name);pass('repeat onboarding cannot overwrite property records');
 const property=await db.query.properties.findFirst({where:eq(properties.id,fixture.propertyId)});
 const [invoice]=await db.insert(propertyInvoices).values({propertyId:fixture.propertyId,organizationId:property!.organizationId,invoiceNumber:`QA-${crypto.randomUUID()}`,recipientName:'Local HTTP Invoice',issueDate:'2026-09-26',dueDate:'2026-09-30',totalAmountMinorUnits:1000,status:'issued'}).returning();
 assert.equal((await request(`/api/invoices/${invoice.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'paid'})})).status,400);pass('invoice cannot be marked paid without a receipt');
 assert.equal((await fetch(base+'/api/invoices/public/'+invoice.invoiceNumber)).status,404);assert.equal((await fetch(base+'/api/invoices/public/'+invoice.id)).status,200);pass('public invoice requires unguessable share reference');
 const [staffUser]=await db.insert(users).values({fullName:'Local Revocation QA',email:`revoke-${crypto.randomUUID()}@example.invalid`,isActive:true}).returning();
 const [member]=await db.insert(propertyMembers).values({propertyId:fixture.propertyId,userId:staffUser.id,role:'front_desk'}).returning();
 const revoke=await request('/api/staff',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberId:member.id,action:'revoke'})});assert.equal(revoke.status,200);assert.ok((await db.query.propertyMembers.findFirst({where:eq(propertyMembers.id,member.id)}))?.permissions?.includes('status:revoked'));pass('staff revocation preserves membership history and removes access');
 const self=await db.query.propertyMembers.findFirst({where});assert.equal((await request('/api/staff',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberId:self!.id,action:'revoke'})})).status,409);pass('staff revocation protects owner and current account');
 assert.equal((await request('/api/calendar?startDate=2026-02-30&endDate=2026-03-03')).status,400);pass('calendar rejects impossible dates');
 console.log(`${count} authenticated HTTP checks passed.`);process.exit(0);
}
run().catch(error=>{console.error(error);process.exit(1)});
