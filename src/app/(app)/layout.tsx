import { redirect } from 'next/navigation';

import { Sidebar } from '@/components/shell/Sidebar';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Row level security is the real boundary; this just avoids rendering a
  // signed-out shell and keeps the account menu honest about who is here.
  const user = await requireUser();

  // Someone on a temporary password gets one destination until they change it.
  if (user.mustChangePassword) redirect('/change-password');

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#2BBFB3]/5 via-white to-[#A5338D]/5">
      <Sidebar user={{ fullName: user.fullName, email: user.email, role: user.role }} />
      {/* `min-w-0` stops the generator's wide two-column layout from forcing
          the whole row to overflow. `pt-14` clears the fixed mobile bar. */}
      <main className="min-w-0 flex-1 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
