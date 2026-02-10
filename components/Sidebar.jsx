"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Map, User, Menu, X, LogOut, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { onAuthStateChangeListener, signOutUser } from '@/lib/firebaseAuth.js';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('sidebar-collapsed') === '1';
    } catch (e) {
      return false;
    }
  });
  const [authed, setAuthed] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChangeListener((user) => {
      setAuthed(!!user);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
    } catch (e) {}
    
    // Set width based on authentication and collapse state
    if (pathname === '/login' || authed === false || authed === null) {
      document.documentElement.style.setProperty('--sidebar-width', '0px');
    } else {
      const width = collapsed ? '64px' : '256px';
      document.documentElement.style.setProperty('--sidebar-width', width);
    }
  }, [collapsed, pathname, authed]);

  // Hide sidebar on login page, when not authenticated, or while auth state is loading
  if (pathname === '/login' || authed === false || authed === null) {
    return null;
  }

  const nav = [
    { href: '/', label: 'Overview', icon: Home },
    { href: '/mappings', label: 'Mappings', icon: Map },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <>
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 bg-[#1E3A5F] text-white p-2 rounded-lg shadow-lg"
      >
        <Menu size={18} />
      </button>

      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`fixed z-50 top-0 left-0 h-full bg-gradient-to-br from-[#2C5F6F] via-[#1E3A5F] to-[#1A2F4F] text-white border-r border-[#2A4A6F] transition-all flex flex-col ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{ width: collapsed ? 64 : 256 }}
      >
        <div className="px-4 py-5 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/ncip-logo-removebg-preview.png"
              alt="logo"
              className="h-10 w-10 rounded-md flex-shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="font-bold text-lg truncate">ADO Mapping</h2>
                <p className="text-sm text-[#F2C94C] truncate">Inventory</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setCollapsed((s) => !s)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:block p-2 rounded-md hover:bg-white/6 transition"
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
            <button
              className="md:hidden p-2 rounded-md hover:bg-white/6 transition"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-2 py-6 overflow-y-auto">
          <ul className="space-y-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition ${
                      active
                        ? 'bg-white/6 border-l-4 border-[#F2C94C] pl-2 text-white'
                        : 'hover:bg-white/3 text-white/90'
                    }`}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!collapsed && <span className="font-medium truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-4 py-6 border-t border-[rgba(255,255,255,0.03)]">
          <button
            onClick={async () => {
              try {
                await signOutUser();
                setOpen(false);
                router.push('/');
              } catch (err) {
                console.error('Error signing out:', err);
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-[#F2C94C] text-[#1E3A5F] font-semibold shadow-sm hover:bg-[#E5BC45] transition"
          >
            <LogOut size={14} className="flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
