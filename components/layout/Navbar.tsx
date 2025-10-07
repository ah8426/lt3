'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserMenu } from './UserMenu';

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b bg-white dark:bg-slate-900 dark:border-slate-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <button
              className="lg:hidden mr-3 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#00BFA5] to-[#1E3A8A] flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white hidden sm:block">
                Law Transcribed
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center lg:space-x-8">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-gray-700 hover:text-[#00BFA5] dark:text-gray-300 dark:hover:text-[#00BFA5] transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/dictation"
              className="text-sm font-medium text-gray-700 hover:text-[#00BFA5] dark:text-gray-300 dark:hover:text-[#00BFA5] transition-colors"
            >
              Dictation
            </Link>
            <Link
              href="/sessions"
              className="text-sm font-medium text-gray-700 hover:text-[#00BFA5] dark:text-gray-300 dark:hover:text-[#00BFA5] transition-colors"
            >
              Sessions
            </Link>
            <Link
              href="/matters"
              className="text-sm font-medium text-gray-700 hover:text-[#00BFA5] dark:text-gray-300 dark:hover:text-[#00BFA5] transition-colors"
            >
              Matters
            </Link>
          </div>

          {/* User Menu */}
          <div className="flex items-center">
            <UserMenu />
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t dark:border-slate-800">
          <div className="space-y-1 px-4 pb-3 pt-2">
            <Link
              href="/dashboard"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-[#00BFA5] dark:text-gray-300 dark:hover:bg-slate-800"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/dictation"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-[#00BFA5] dark:text-gray-300 dark:hover:bg-slate-800"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dictation
            </Link>
            <Link
              href="/sessions"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-[#00BFA5] dark:text-gray-300 dark:hover:bg-slate-800"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Sessions
            </Link>
            <Link
              href="/matters"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-[#00BFA5] dark:text-gray-300 dark:hover:bg-slate-800"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Matters
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
