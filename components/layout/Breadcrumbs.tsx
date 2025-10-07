'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { Fragment } from 'react';

const routeNames: Record<string, string> = {
  dashboard: 'Dashboard',
  dictation: 'Dictation',
  sessions: 'Sessions',
  matters: 'Matters',
  settings: 'Settings',
  profile: 'Profile',
  billing: 'Billing',
  help: 'Help & Support',
};

export function Breadcrumbs() {
  const pathname = usePathname();

  if (!pathname || pathname === '/') {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const breadcrumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const name = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === segments.length - 1;

    return {
      name,
      href,
      isLast,
    };
  });

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol role="list" className="flex items-center space-x-2">
        <li>
          <div>
            <Link
              href="/dashboard"
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Home</span>
            </Link>
          </div>
        </li>
        {breadcrumbs.map((breadcrumb) => (
          <li key={breadcrumb.href}>
            <div className="flex items-center">
              <ChevronRight
                className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-600"
                aria-hidden="true"
              />
              {breadcrumb.isLast ? (
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {breadcrumb.name}
                </span>
              ) : (
                <Link
                  href={breadcrumb.href}
                  className="ml-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {breadcrumb.name}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
