'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  FilePlus2,
  History,
  House,
  ImageIcon,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Sparkles,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { AccountMenu } from '@/components/shell/AccountMenu';
import { useLocalPreference } from '@/hooks/useLocalPreference';
import type { AppRole } from '@/lib/auth';

/**
 * Dashboard navigation.
 *
 * Written for people who are not technical and who are often mid-appointment.
 * Four rules it follows:
 *
 *  1. Labels say what you get, in words someone would actually say out loud.
 *     "Make a plan", not "Generator". "History", not "Activity log".
 *  2. Nothing unfinished is linked without saying so first. Every not-yet-built
 *     page is marked "Soon" BEFORE it is clicked, so nobody lands somewhere
 *     empty and wonders whether they broke it.
 *  3. Both plan editors are listed. "Make a plan" is the newer one; "Classic
 *     builder" is the screen the team already knows, unchanged and going
 *     nowhere. Neither is labelled "legacy" — that is our word for it, not
 *     theirs, and it would read as "about to be taken away".
 *  4. The Manage group is hidden entirely from staff rather than shown and
 *     refused. Offering a door that will not open is worse than no door.
 */

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown as "Soon" and styled back; the page explains what is coming. */
  soon?: boolean;
};

const MAIN_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: House },
  { href: '/plans/new', label: 'Make a plan', icon: FilePlus2 },
  { href: '/legacy', label: 'Classic builder', icon: Sparkles },
  { href: '/plans', label: 'Saved plans', icon: ClipboardList },
  { href: '/fees', label: 'Fee schedule', icon: Receipt },
];

const MANAGE_NAV: NavItem[] = [
  { href: '/admin/staff', label: 'Dentists', icon: Users },
  { href: '/admin/accounts', label: 'Accounts', icon: UserCog },
  { href: '/admin/templates', label: 'Templates', icon: ImageIcon },
  { href: '/admin/activity', label: 'History', icon: History },
];

const COLLAPSED_KEY = 'sia-sidebar-collapsed';

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  // /plans/new is its own page, not a child of Saved plans.
  if (href === '/plans') return pathname === '/plans';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      // Collapsed, the icon is the only label, so the accessible name and the
      // hover tooltip both have to carry it.
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        // The left rule carries the active state and always occupies its 3px,
        // lit or not, so nothing shifts sideways as you move between pages.
        'group flex items-center rounded-r-md border-l-[3px] py-2 text-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sia-teal',
        collapsed ? 'justify-center pl-0 pr-[3px]' : 'gap-3 pl-3 pr-2.5',
        active
          ? 'border-sia-teal bg-sia-teal/10 font-semibold text-sia-dark'
          : 'border-transparent font-medium text-slate-500 hover:bg-slate-900/[0.04] hover:text-sia-dark'
      )}
    >
      <Icon
        className={cn('h-4 w-4 shrink-0', active ? 'text-sia-teal' : 'text-slate-400')}
        aria-hidden
      />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {item.soon && (
            // Right-aligned so every marker lands in one column. Scattered
            // inline these read as clutter; lined up they read as a state.
            <span className="ml-auto shrink-0 text-[11px] font-medium text-slate-400">Soon</span>
          )}
        </>
      )}
    </Link>
  );
}

type SidebarUser = {
  fullName: string;
  email: string;
  role: AppRole;
};

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useLocalPreference(COLLAPSED_KEY, false);
  const isAdmin = user.role === 'admin';

  const toggleCollapsed = () => setCollapsed(!collapsed);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  // The mobile drawer is always full width — collapsing only earns its keep
  // where the sidebar is competing with the page for horizontal room.
  const railCollapsed = collapsed && !open;

  return (
    <>
      {/* Below `lg` the sidebar is a drawer, so small screens get a bar. */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-900/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sia-teal"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Brand />
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={close}
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden"
        />
      )}

      <aside
        className={cn(
          'z-50 flex shrink-0 flex-col border-r bg-white transition-[width] duration-200',
          railCollapsed ? 'w-16' : 'w-60',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-60 max-lg:transition-transform',
          'lg:sticky lg:top-0 lg:h-screen',
          open ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
        )}
      >
        <div
          className={cn(
            'flex items-center py-4',
            railCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          <Brand iconOnly={railCollapsed} />
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-900/5 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav
          className={cn(
            'flex flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden py-2',
            railCollapsed ? 'px-2' : 'pr-3'
          )}
        >
          <ul className="space-y-0.5">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  pathname={pathname}
                  collapsed={railCollapsed}
                  onNavigate={close}
                />
              </li>
            ))}
          </ul>

          {isAdmin && (
            <div>
              {railCollapsed ? (
                // A text heading would have nowhere to go in 16 units, so the
                // group boundary reads as a rule instead.
                <hr className="mx-2 mb-2 border-t" aria-hidden />
              ) : (
                <p className="mb-1 pl-[15px] text-xs font-semibold text-slate-400">Manage</p>
              )}
              <ul className="space-y-0.5">
                {MANAGE_NAV.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      pathname={pathname}
                      collapsed={railCollapsed}
                      onNavigate={close}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* Collapsing is a desktop affordance; the drawer is already hidden. */}
        <div className="hidden lg:block">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand the menu' : 'Collapse the menu'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand the menu' : 'Collapse the menu'}
            className={cn(
              'flex w-full items-center gap-3 border-t py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900/[0.04] hover:text-sia-dark',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sia-teal',
              railCollapsed ? 'justify-center px-0' : 'px-4'
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>

        <AccountMenu
          fullName={user.fullName}
          email={user.email}
          role={user.role}
          collapsed={railCollapsed}
        />
      </aside>
    </>
  );
}

function Brand({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <Link
      href="/"
      title={iconOnly ? 'SIA Dental' : undefined}
      aria-label={iconOnly ? 'SIA Dental' : undefined}
      className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sia-teal"
    >
      <Image
        src="/brand/logo-favicon.png"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0"
        aria-hidden
      />
      {!iconOnly && (
        <span className="whitespace-nowrap text-base font-bold leading-none">
          <span className="text-sia-teal">SIA</span>
          <span className="text-sia-purple">Dental</span>
        </span>
      )}
    </Link>
  );
}
