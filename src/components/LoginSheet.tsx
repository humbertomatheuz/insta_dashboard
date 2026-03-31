'use client';

import React, { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LogIn, Key, Eye, EyeOff, Camera, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface LoginSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLoginSuccess: (sessionId: string, username: string) => void;
}

export default function LoginSheet({ open, onOpenChange, onLoginSuccess }: LoginSheetProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  const reset = () => {
    setError('');
    setHint('');
    setLoading(false);
  };

  const handleCredentialLogin = async () => {
    if (!username || !password) { setError('Preencha usuário e senha.'); return; }
    reset();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success && data.sessionId) {
        onLoginSuccess(data.sessionId, data.username || username);
        onOpenChange(false);
      } else {
        setError(data.error || 'Falha no login.');
        if (data.requiresManual) setShowManual(true);
      }
    } catch {
      setError('Erro de rede. Tente usar o SessionID manualmente.');
      setShowManual(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogin = async () => {
    if (!sessionId.trim()) { setError('Cole o SessionID abaixo.'); return; }
    reset();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.trim() }),
      });
      const data = await res.json();
      if (data.success && data.sessionId) {
        onLoginSuccess(data.sessionId, data.username || 'usuário');
        onOpenChange(false);
      } else {
        setError(data.error || 'SessionID inválido.');
      }
    } catch {
      setError('Erro de rede ao validar SessionID.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        className={`fixed top-0 right-0 h-full bg-[#0a0a0a] border-l border-white/10 overflow-y-auto transition-transform duration-500 ease-in-out z-50 w-full sm:w-[450px]
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="absolute top-4 right-4 z-50">
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </Button>
        </div>

        <div className="p-8 space-y-8 mt-4">
          {/* Header */}
          <div className="p-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl insta-gradient">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Entrar</h2>
                <p className="text-white/40 text-xs mt-1">
                  Autentique para usar o scraper
                </p>
              </div>
            </div>
          </div>

          {/* Credential Form */}
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleCredentialLogin(); }}>
            <p className="text-xs font-bold uppercase tracking-widest text-white/30">Login Instagram</p>
            <div className="space-y-3">
              <Input
                name="username"
                id="username"
                autoComplete="username"
                placeholder="@usuário do Instagram"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus-visible:ring-[#bc1888]/50"
              />
              <div className="relative">
                <Input
                  name="password"
                  id="password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl pr-12 focus-visible:ring-[#bc1888]/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full h-12 insta-gradient text-white font-bold rounded-xl neon-glow border border-white/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
            >
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Autenticando...</>
                : <><LogIn className="mr-2 h-4 w-4" />Realizar Login no Instagram</>
              }
            </Button>

            <p className="text-[11px] text-white/25 text-center leading-relaxed">
              Suas credenciais são enviadas diretamente ao Instagram e não são armazenadas.
            </p>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/20 uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Manual SessionID */}
          <div className="space-y-3">
            <button
              onClick={() => setShowManual(v => !v)}
              className="flex items-center justify-between w-full text-left group"
            >
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-[#f09433]" />
                <span className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">
                  Inserir SessionID manualmente
                </span>
              </div>
              {showManual
                ? <ChevronUp className="h-4 w-4 text-white/30" />
                : <ChevronDown className="h-4 w-4 text-white/30" />
              }
            </button>

            {showManual && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-xs text-white/40 leading-relaxed">
                  Vá em <span className="text-[#f09433]">instagram.com</span> → F12 → Application → Cookies → <code className="bg-white/10 px-1 rounded">sessionid</code>
                </p>
                <Input
                  placeholder="Cole o sessionid aqui..."
                  value={sessionId}
                  onChange={e => setSessionId(e.target.value)}
                  disabled={loading}
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl font-mono text-xs focus-visible:ring-[#f09433]/50"
                />
                <Button
                  onClick={handleManualLogin}
                  disabled={loading || !sessionId.trim()}
                  variant="outline"
                  className="w-full h-11 bg-[#f09433]/10 border-[#f09433]/30 text-[#f09433] hover:bg-[#f09433]/20 rounded-xl font-bold"
                >
                  {loading
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando...</>
                    : <><Key className="mr-2 h-4 w-4" />Entrar com SessionID</>
                  }
                </Button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 leading-relaxed">{error}</p>
            </div>
          )}
          {hint && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-300 leading-relaxed">{hint}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
