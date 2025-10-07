'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Mic,
  FileText,
  Briefcase,
  Settings,
  HelpCircle,
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Dictation',
    href: '/dictation',
    icon: Mic,
  },
  {
    name: 'Sessions',
    href: '/sessions',
    icon: FileText,
  },
  {
    name: 'Matters',
    href: '/matters',
    icon: Briefcase,
  },
];

const secondaryNavigation = [
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
  {
    name: 'Help & Support',
    href: '/help',
    icon: HelpCircle,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:pt-16">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-white dark:bg-slate-900 dark:border-slate-800 px-6 pb-4">
        <nav className="flex flex-1 flex-col pt-6">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          isActive
                            ? 'bg-[#00BFA5]/10 text-[#00BFA5] font-semibold'
                            : 'text-gray-700 hover:text-[#00BFA5] hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 transition-colors'
                        )}
                      >
                        <item.icon
                          className={cn(
                            isActive ? 'text-[#00BFA5]' : 'text-gray-400 group-hover:text-[#00BFA5]',
                            'h-6 w-6 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
            <li className="mt-auto">
              <ul role="list" className="-mx-2 space-y-1">
                {secondaryNavigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          isActive
                            ? 'bg-[#00BFA5]/10 text-[#00BFA5] font-semibold'
                            : 'text-gray-700 hover:text-[#00BFA5] hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 transition-colors'
                        )}
                      >
                        <item.icon
                          className={cn(
                            isActive ? 'text-[#00BFA5]' : 'text-gray-400 group-hover:text-[#00BFA5]',
                            'h-6 w-6 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  );
}
