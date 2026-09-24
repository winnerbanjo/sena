import { Button } from '@sena/ui';
import { loginAdmin } from '../actions';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('sena_admin_auth');
  
  if (authCookie?.value === 'authenticated') {
    redirect('/');
  }
  
  const resolvedParams = await searchParams;
  const error = resolvedParams.error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2]">
      <div className="w-full max-w-sm p-8 bg-white border border-[#E8E2DA] rounded-lg shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-serif text-[#191816]">Sena Control Plane</h1>
          <p className="text-sm text-gray-500 mt-1">Enter master password</p>
        </div>
        <form action={loginAdmin} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100 text-center">
              Invalid password
            </div>
          )}
          <div>
            <input 
              type="password" 
              name="password" 
              placeholder="Password" 
              required 
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#191816] focus:border-[#191816]"
            />
          </div>
          <Button type="submit" className="w-full bg-[#191816] text-white hover:bg-black">
            Access System
          </Button>
        </form>
      </div>
    </div>
  );
}
