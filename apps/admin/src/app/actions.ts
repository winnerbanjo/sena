'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function loginAdmin(formData: FormData) {
  const password = formData.get('password');
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';
  
  if (password === expectedPassword) {
    const cookieStore = await cookies();
    cookieStore.set('sena_admin_auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    redirect('/');
  } else {
    redirect('/login?error=1');
  }
}
