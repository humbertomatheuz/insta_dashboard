'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  MessageCircle, Download, Filter, Heart, ChevronRight,
  Zap, Shield, TrendingUp, Camera,
} from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
}

const features = [
  {
    icon: MessageCircle,
    color: '#bc1888',
    title: 'Extração em Massa',
    desc: 'Colete milhares de comentários com scroll infinito automático e paginação inteligente por token.',
  },
  {
    icon: Filter,
    color: '#dc2743',
    title: 'Filtros Avançados',
    desc: 'Busque por texto ou @usuário, aplique blacklist de palavras e oculte comentários apenas com emojis.',
  },
  {
    icon: MessageCircle,
    color: '#f09433',
    title: 'Análise de Respostas',
    desc: 'Expanda qualquer comentário para ver respostas em cadeia carregadas sob demanda.',
  },
  {
    icon: Heart,
    color: '#833AB4',
    title: 'Métricas de Curtidas',
    desc: 'Visualize curtidas por comentário e resposta, ordenadas e filtradas em tempo real.',
  },
  {
    icon: Download,
    color: '#bc1888',
    title: 'Exportação CSV',
    desc: 'Exporte selecionados ou todos os comentários filtrados em CSV com encoding UTF-8 para Excel.',
  },
  {
    icon: Zap,
    color: '#f09433',
    title: 'Carregar Tudo',
    desc: 'Um clique para baixar automaticamente todos os comentários disponíveis com progresso em tempo real.',
  },
];

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  return (
    <div className="min-h-screen font-sans relative overflow-x-hidden pb-20">

      {/* ── Hero ── */}
      <section className="relative pt-20 pb-16 px-4 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border border-[#bc1888]/30 mb-8">
          <Camera className="h-4 w-4 text-[#f09433] animate-pulse" />
          <span className="text-xs font-bold tracking-widest uppercase insta-text-gradient">
            Instagram Analytics Dashboard
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter insta-text-gradient pb-4 drop-shadow-[0_0_30px_rgba(237,73,86,0.3)] leading-none mb-6">
          Inteligência de<br />Rede Social
        </h1>

        <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
          Extraia, filtre e analise comentários do Instagram com scroll infinito,
          paginação por token e exportação inteligente — sem limites artificiais.
        </p>

        <div className="flex flex-col items-center justify-center gap-4">
          <Button
            id="btn-entrar"
            onClick={onLoginClick}
            size="lg"
            className="w-auto h-14 px-10 text-lg font-black rounded-2xl insta-gradient text-white neon-glow border border-white/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
          >
            <Shield className="mr-2 h-5 w-5" />
            Entrar e Analisar
            <ChevronRight className="ml-1 h-5 w-5" />
          </Button>
          <p className="text-white/30 text-sm">Conexão direta com o Instagram. Gratuito.</p>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="max-w-4xl mx-auto px-4 mb-20">
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: '∞', label: 'Comentários', color: '#f09433' },
            { value: '0', label: 'APIs Pagas', color: '#dc2743' },
            { value: '100%', label: 'Client-side Filters', color: '#bc1888' },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-2xl p-6 text-center border border-white/10 glass-card-hover">
              <p className="text-3xl md:text-4xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-white/40 uppercase tracking-widest font-bold">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="max-w-5xl mx-auto px-4 mb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
            Tudo que você precisa
          </h2>
          <p className="text-white/40 text-base">Funcionalidades prontas para análise profissional</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, color, title, desc }) => (
            <div
              key={title}
              className="glass-card glass-card-hover rounded-2xl p-6 border border-white/10 group transition-all duration-300 hover:-translate-y-1"
            >
              <div
                className="inline-flex p-3 rounded-xl mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${color}20`, border: `1px solid ${color}30` }}
              >
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <h3 className="font-bold text-white mb-2 text-base">{title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="max-w-3xl mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl glass-card border border-[#bc1888]/30 p-10 text-center">
          <div className="absolute inset-0 insta-gradient opacity-10 pointer-events-none" />
          <TrendingUp className="h-10 w-10 text-[#f09433] mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
            Comece agora gratuitamente
          </h2>
          <p className="text-white/50 mb-6 text-sm">
            Faça login com sua conta do Instagram ou use um SessionID capturado manualmente.
          </p>
          <Button
            id="btn-entrar-2"
            onClick={onLoginClick}
            size="lg"
            className="h-12 px-8 font-bold rounded-xl insta-gradient text-white neon-glow border border-white/20 hover:scale-105 transition-all"
          >
            <LogInIcon className="mr-2 h-4 w-4" />
            Entrar agora
          </Button>
        </div>
      </section>
    </div>
  );
}

// Small inline icon to avoid import collision
function LogInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}
