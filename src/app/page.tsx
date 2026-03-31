'use client';

import React, { useState, useEffect } from 'react';
import LandingPage from '@/components/LandingPage';
import LoginSheet from '@/components/LoginSheet';
import Dashboard from '@/components/Dashboard';

interface AuthState {
  sessionId: string;
  username: string;
}

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [mounted, setMounted] = useState(false);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = sessionStorage.getItem('insta_auth');
      if (stored) {
        const parsed = JSON.parse(stored) as AuthState;
        if (parsed.sessionId) setAuth(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  const handleLoginSuccess = (sessionId: string, username: string) => {
    const state: AuthState = { sessionId, username };
    setAuth(state);
    try {
      sessionStorage.setItem('insta_auth', JSON.stringify(state));
    } catch { /* ignore */ }
  };

  const handleLogout = () => {
    setAuth(null);
    try { sessionStorage.removeItem('insta_auth'); } catch { /* ignore */ }
  };

  if (!mounted) return null;

  return (
    <div className="relative flex w-full min-h-screen overflow-hidden">
      {/* Main Content Area */}
      <div 
        className={`flex-1 transition-all duration-500 ease-in-out ${
          loginOpen ? 'mr-0 sm:mr-[450px]' : 'mr-0'
        }`}
      >
        {auth ? (
          <div
            key="dashboard"
            className="animate-in fade-in duration-500 w-full"
            style={{ animationFillMode: 'both' }}
          >
            <Dashboard
              sessionId={auth.sessionId}
              authUsername={auth.username}
              onLogout={handleLogout}
            />
          </div>
        ) : (
          <div
            key="landing"
            className="animate-in fade-in duration-500 w-full"
            style={{ animationFillMode: 'both' }}
          >
            <LandingPage onLoginClick={() => setLoginOpen(true)} />
          </div>
        )}
      </div>

      {/* Side Panel Overlay for mobile only */}
      {loginOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 sm:hidden transition-opacity" 
          onClick={() => setLoginOpen(false)}
        />
      )}

      {/* Login Side Panel */}
      <div className="fixed inset-y-0 right-0 z-50">
        <LoginSheet
          open={loginOpen}
          onOpenChange={setLoginOpen}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    </div>
  );
}
