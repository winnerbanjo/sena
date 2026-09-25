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
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#191816] font-sans selection:bg-[#71382D]/20">
      <header className="px-6 sm:px-12 h-20 flex items-center justify-between border-b border-[#EAE3D9] bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center">
          <img
            src="/assets/sena-logo.png"
            alt="Sena"
            width={96}
            height={32}
            className="h-6 sm:h-7 w-auto object-contain"
          />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 sm:px-12 py-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Atmospheric Hospitality Editorial */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between space-y-8">
            <div className="space-y-4">
              <span className="text-[11px] font-mono tracking-widest text-[#B85C3E] uppercase">
                Sena Internal
              </span>
              <h2 className="text-3xl font-serif font-normal text-[#71382D] leading-tight">
                Control plane for the hospitality OS.
              </h2>
              <p className="text-sm text-[#7A7267] leading-relaxed">
                Log in to the internal dashboard to manage tenant properties, monitor active subscriptions, and oversee master administrative logs.
              </p>
            </div>

            <div className="relative rounded-lg overflow-hidden border border-[#E8E1D5] shadow-sm aspect-[4/3] bg-[#EAE3D9]">
              <img
                src="/assets/resort.jpg"
                alt="Internal architecture"
                className="object-cover w-full h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-4">
                <span className="text-[11px] text-white/90 tracking-wide font-mono">
                  Sena Infrastructure · Superadmin
                </span>
              </div>
            </div>
          </div>

          {/* Right: The Sign-in Ledger */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#E8E1D5] p-8 sm:p-10 shadow-[0_4px_24px_rgba(25,24,22,0.03)]">
            <div className="mb-8">
              <h1 className="text-2xl font-serif font-normal text-[#191816]">
                Administrator Login
              </h1>
              <p className="text-xs text-[#7A7267] mt-1.5">
                Enter the master password to access internal property operations.
              </p>
            </div>

            <form action={loginAdmin} className="space-y-5">
              {error && (
                <div className="p-3 rounded-md bg-[#FAF4EF] border border-[#E5D4BC] text-[#71382D] text-xs leading-relaxed">
                  Incorrect master password. Please try again.
                </div>
              )}
              
              <div>
                <label className="block text-xs font-medium text-[#191816] mb-1.5">
                  Internal Clearance Code
                </label>
                <div className="relative">
                  <input
                    type="password"
                    name="password"
                    placeholder="••••••••••••"
                    className="w-full h-11 px-3.5 rounded-md border border-[#E8E1D5] bg-[#FAF7F2]/40 text-[#191816] text-sm focus:bg-white focus:outline-none focus:border-[#71382D] transition-all placeholder:text-[#A69E92]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-md bg-[#B85C3E] hover:bg-[#A34E32] text-white text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-2"
              >
                Access Control Plane &rarr;
              </button>

              <div className="pt-4 border-t border-[#F0ECE4] text-center mt-6">
                <p className="text-xs text-[#7A7267]">
                  This area is strictly for Sena engineering and administration.
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
