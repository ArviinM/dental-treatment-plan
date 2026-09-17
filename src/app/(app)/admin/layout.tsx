import { requireAdmin } from '@/lib/auth';

/**
 * Everything under /admin is Ericka's. requireAdmin() sends a staff member
 * home rather than to a login form — they ARE signed in, they simply are not
 * allowed here, and a login box would just be confusing.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
