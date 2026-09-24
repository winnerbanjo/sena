import { db, verificationTokens, users } from '@sena/database';
import { eq } from 'drizzle-orm';

async function main() {
  const testEmail = `verify.test.${Date.now()}@sena.ng`;
  console.log('1. Testing OTP send for:', testEmail);

  const sendRes = await fetch('http://localhost:3000/api/auth/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, userName: 'Verification Tester' }),
  });
  const sendData = await sendRes.json();
  console.log('Send response status:', sendRes.status, sendData);

  if (!sendRes.ok) {
    throw new Error(`Failed to send OTP: ${JSON.stringify(sendData)}`);
  }

  // Check database for generated token
  const [tokenRecord] = await db
    .select()
    .from(verificationTokens)
    .where(eq(verificationTokens.identifier, testEmail))
    .limit(1);

  console.log('2. Stored verification token record in PostgreSQL:', tokenRecord);

  if (!tokenRecord) {
    throw new Error('No token record found in database!');
  }

  console.log('3. Testing OTP verify with code:', tokenRecord.token);
  const verifyRes = await fetch('http://localhost:3000/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, code: tokenRecord.token }),
  });
  const verifyData = await verifyRes.json();
  console.log('4. Verify response status:', verifyRes.status, verifyData);

  if (verifyRes.ok && verifyData.success) {
    console.log('🎉 100% SUCCESS: Email OTP complete cycle verified!');
  } else {
    throw new Error(`Verification failed: ${JSON.stringify(verifyData)}`);
  }

  // Clean up test token
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, testEmail));
  console.log('5. Cleaned up verification token test record.');
}

main().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
