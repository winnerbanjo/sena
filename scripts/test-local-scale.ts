import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';
requireIsolatedTestDatabase();
const base=process.env.SENA_TEST_APP_URL || 'http://localhost:3101';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local only');
async function run(){
 const {db,organizations,properties,users,propertyMembers,organizationMembers,roomTypes,rooms,guests,reservations,payments}=await import('../packages/database/src/index');
 const runId=crypto.randomUUID().slice(0,8);
 const [org]=await db.insert(organizations).values({name:'Local scale QA',slug:`scale-${runId}`}).returning();
 const [property]=await db.insert(properties).values({organizationId:org.id,name:'Local Scale QA',slug:`scale-${runId}`,code:`SQ-${runId}`,address:'Local only',email:'scale@example.invalid',phone:''}).returning();
 const [roomType]=await db.insert(roomTypes).values({propertyId:property.id,name:'Scale Double',bedType:'Double',basePriceMinorUnits:10000,capacity:2,totalInventory:100}).returning();
 await db.insert(rooms).values(Array.from({length:100},(_,i)=>({propertyId:property.id,roomTypeId:roomType.id,roomNumber:String(i+100),operationalStatus:'available',housekeepingStatus:'clean'})));
 const guestRows=[];
 for(let batch=0;batch<10;batch++) guestRows.push(...await db.insert(guests).values(Array.from({length:500},(_,i)=>({organizationId:org.id,propertyId:property.id,fullName:`Synthetic Guest ${batch*500+i}`,email:`scale-${runId}-${batch*500+i}@example.invalid`,phone:''}))).returning({id:guests.id}));
 const bookings=[];
 for(let batch=0;batch<10;batch++) bookings.push(...await db.insert(reservations).values(Array.from({length:100},(_,i)=>({propertyId:property.id,roomTypeId:roomType.id,guestId:guestRows[batch*100+i].id,reference:`SQ-${runId}-${batch*100+i}`,checkInDate:`2027-01-${String(batch+1).padStart(2,'0')}`,checkOutDate:`2027-01-${String(batch+2).padStart(2,'0')}`,nights:1,numGuests:1,adults:1,children:0,source:'walk_in',status:'confirmed',paymentStatus:batch<4?'part_payment':'pay_later',totalAmountMinorUnits:10000,paidAmountMinorUnits:batch<4?5000:0}))).returning({id:reservations.id}));
 await db.insert(payments).values(bookings.slice(0,400).map(b=>({propertyId:property.id,reservationId:b.id,amountMinorUnits:5000,currency:'NGN',provider:'manual',method:'cash',status:'successful'})));
 const email=`scale-owner-${runId}@example.invalid`,password=`Local-Scale-${runId}!`;
 const [owner]=await db.insert(users).values({fullName:'Local Scale Owner',email,passwordHash:await bcrypt.hash(password,10),isActive:true,emailVerified:new Date()}).returning();
 await db.insert(propertyMembers).values({propertyId:property.id,userId:owner.id,role:'owner'});
 await db.insert(organizationMembers).values({organizationId:org.id,userId:owner.id,role:'owner'});
 const cookies=new Map<string,string>();
 async function request(path:string,options:RequestInit={}){const r=await fetch(base+path,{...options,headers:{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...options.headers},redirect:'manual'});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1));}return r;}
 const csrf=await(await request('/api/auth/csrf')).json();
 await request('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Auth-Return-Redirect':'1'},body:new URLSearchParams({csrfToken:csrf.csrfToken,email,password,callbackUrl:base})});
 for(const [route,key,count] of [['guests','guests',5000],['reservations','reservations',1000],['rooms','rooms',100],['payments','payments',400]] as const){
  await request('/api/'+route); // Warm compilation; timed request includes body parsing.
  const start=performance.now();const r=await request('/api/'+route);assert.equal(r.status,200);const data=await r.json();const ms=Math.round(performance.now()-start);assert.equal(data[key].length,count);console.log(`PASS ${route}: ${count} records, ${ms} ms warm local HTTP`);
 }
 console.log('4 local-scale data checks passed. Timings are development-mode observations, not production SLO certification.');process.exit(0);
}
run().catch(error=>{console.error(error);process.exit(1)});
