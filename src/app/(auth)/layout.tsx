import Image from 'next/image';

/**
 * Shell for the signed-out pages. No nav: there is nowhere to go yet.
 * src/proxy.ts already bounces signed-in users away from these routes.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#2BBFB3]/5 via-white to-[#A5338D]/5 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/brand/logo-favicon.png"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12"
            aria-hidden
          />
          <p className="mt-3 text-xl font-bold">
            <span className="text-sia-teal">SIA</span>
            <span className="text-sia-purple">Dental</span>
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
