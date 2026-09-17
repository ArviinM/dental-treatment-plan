'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronUp, KeyRound, LogOut } from 'lucide-react';

import { signOut } from '@/app/(auth)/actions';
import type { AppRole } from '@/lib/auth';

type AccountMenuProps = {
  fullName: string;
  email: string;
  role: AppRole;
  /** In the collapsed rail only the avatar fits. */
  collapsed?: boolean;
};

/** Initials for the avatar, e.g. "Ericka Reyes" -> "ER". */
function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function AccountMenu({ fullName, email, role, collapsed = false }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative border-t py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
      {open && (
        <div
          role="menu"
          className={`absolute bottom-full mb-1 overflow-hidden rounded-md border bg-white py-1 shadow-lg ${
            collapsed ? 'left-2 w-48' : 'left-3 right-3'
          }`}
        >
          <Link
            href="/change-password"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-900/5"
          >
            <KeyRound className="h-4 w-4 text-slate-400" aria-hidden />
            Change password
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-900/5"
            >
              <LogOut className="h-4 w-4 text-slate-400" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={collapsed ? fullName : undefined}
        aria-label={collapsed ? `${fullName} — account menu` : undefined}
        className={`flex w-full items-center rounded-md p-1.5 text-left hover:bg-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sia-teal ${
          collapsed ? 'justify-center' : 'gap-2.5'
        }`}
      >
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sia-teal/15 text-xs font-bold text-sia-dark"
        >
          {initials(fullName)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-sia-dark">{fullName}</span>
              <span className="block truncate text-xs text-slate-400">
                {role === 'admin' ? 'Admin' : email}
              </span>
            </span>
            <ChevronUp
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                open ? '' : 'rotate-180'
              }`}
              aria-hidden
            />
          </>
        )}
      </button>
    </div>
  );
}
