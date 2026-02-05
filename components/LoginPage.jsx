'use client';

import React, { useEffect, useState } from 'react';
import { Bell, Eye, EyeOff, MapPin } from 'lucide-react';

export function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState(null);
  const [alertTick, setAlertTick] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!alert) return;
    const timeoutId = setTimeout(() => setAlert(null), 10_000);
    return () => clearTimeout(timeoutId);
  }, [alertTick, alert]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);
    setIsLoading(true);

    try {
      // Check for test credentials
      const normalizedUsername = username.trim().toLowerCase();
      if (normalizedUsername === 'ncip' && password === 'admin123') {
        setAlertTick((t) => t + 1);
        setAlert({ type: 'success', message: 'Login successful. Redirecting…' });
        await new Promise((r) => setTimeout(r, 450));
        onLogin({
          uid: 'ncip_admin',
          email: 'ncip@ado.gov.ph',
          role: 'admin',
          communityName: 'NCIP Admin'
        });
        return;
      }
      
      setAlertTick((t) => t + 1);
      setAlert({ type: 'error', message: 'Invalid username or password.' });
    } catch (error) {
      setAlertTick((t) => t + 1);
      const errorMessage = error.message || 'Authentication failed';
      setAlert({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden relative bg-[#0A2D55]">
      {/* Custom background: gradients + subtle pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.18), transparent 30%),
            radial-gradient(circle at 80% 10%, rgba(255, 215, 0, 0.12), transparent 28%),
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.06), transparent 42%),
            linear-gradient(135deg, #0A2D55 0%, #0C3B6E 40%, #0A2D55 100%)
          `,
        }}
        aria-hidden
      />
      <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#d9e4ff 1px, transparent 1px)', backgroundSize: '36px 36px' }} aria-hidden />

      <div className="relative z-10 h-full w-full flex items-center justify-center px-4 sm:px-6 md:px-8">
        <div className="w-full max-w-md">
          {/* Alert (outside the form/card) */}
          {alert && (
            <div className="fixed z-30 right-4 bottom-4 sm:bottom-auto sm:top-4 w-[min(92vw,360px)] sm:w-96">
              <div
                key={alertTick}
                role="alert"
                className={[
                  'ncip-animate-alert-in rounded-xl border p-3 text-xs sm:text-sm backdrop-blur-xl shadow-2xl shadow-black/30',
                  alert.type === 'error'
                    ? 'ncip-animate-shake bg-red-500/15 border-red-500/30 text-red-50'
                    : 'bg-emerald-400/15 border-emerald-300/30 text-emerald-50',
                ].join(' ')}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                    <Bell className="h-4 w-4 text-current" aria-hidden />
                  </div>
                  <p className="leading-snug">{alert.message}</p>
                </div>
              </div>
            </div>
          )}

          <div className="relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-black/35 overflow-hidden">
            {/* Glass loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071A2C]/20 backdrop-blur-md">
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-full border border-white/20 bg-white/10 backdrop-blur-xl shadow-xl shadow-black/30 p-4">
                    <div className="h-12 w-12 rounded-full border-2 border-white/25 border-t-[#F2C94C] animate-spin" />
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/10 backdrop-blur-xl px-4 py-2 text-xs text-white/80">
                    Loading…
                  </div>
                </div>
              </div>
            )}

            {/* Panel header */}
            <div className="p-6 sm:p-7 border-b border-white/15 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#F2C94C]/10 via-transparent to-[#F2C94C]/10" aria-hidden />
              <div className="relative flex items-start gap-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#0B3A63]/75 ring-1 ring-white/20 flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/20">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-[#F2C94C]" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight text-balance">
                    ADO Mapping Inventory System
                  </h1>
                  <p className="mt-1 text-sm sm:text-[15px] text-white/75 text-balance">
                    Indigenous Cultural Communities Mapping Management System
                  </p>
                </div>
              </div>
            </div>

            {/* Panel body */}
            <div className="p-6 sm:p-7">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-xs sm:text-sm font-semibold text-white/90 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ncip"
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/35 focus:border-[#F2C94C]/35 transition bg-white/10 text-white placeholder:text-white/60 backdrop-blur-md shadow-inner shadow-black/10"
                autoComplete="username"
                disabled={isLoading}
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs sm:text-sm font-semibold text-white/90 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F2C94C]/35 focus:border-[#F2C94C]/35 transition bg-white/10 text-white placeholder:text-white/60 backdrop-blur-md pr-11 shadow-inner shadow-black/10"
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition active:scale-95 p-1 rounded-md hover:bg-white/10"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#0B3A63] to-[#092E4F] hover:from-[#0A355D] hover:to-[#082642] active:scale-[0.99] text-white font-semibold py-3 sm:py-3 text-sm sm:text-base rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6 touch-manipulation shadow-lg shadow-black/30 ring-1 ring-white/10"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-white/15 text-center text-[11px] sm:text-xs text-white/70">
                <span className="font-medium">NCIP ADO Mapping Inventory System</span>{' '}
                <span className="whitespace-nowrap">© 2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
