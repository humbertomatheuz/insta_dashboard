'use client';

import React, { useState, useCallback, useRef } from 'react';
import { exportToCSV } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, Download, Loader2, Heart, MessageCircle,
  Filter, FileText, Camera, ChevronDown, ChevronUp,
  RefreshCw
} from 'lucide-react';

interface ChildComment {
  id: string;
  text: string;
  ownerUsername: string;
  ownerProfilePicUrl: string;
  timestamp: string;
  likesCount: number;
}

interface Comment {
  id: string;
  avatar: string;
  username: string;
  text: string;
  date: string;
  likesCount: number;
  repliesCount: number;
  childComments: ChildComment[];
  profile_link: string;
}

interface PostMeta {
  owner_name: string | null;
  likes_count: number | null;
  comments_count: number;
  thumbnail_url: string | null;
  video_url: string | null;
  caption: string | null;
  totalItems: number;
}

interface PageResult {
  comments: Comment[];
  total: number;
  totalAll: number;
  occurrences: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

type RunStatus = 'idle' | 'starting' | 'running' | 'succeeded' | 'failed';

export default function Home() {
  const [url, setUrl] = useState('');
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [datasetId, setDatasetId] = useState('');
  const [itemsScraped, setItemsScraped] = useState(0);
  const [meta, setMeta] = useState<PostMeta | null>(null);
  const [pageResult, setPageResult] = useState<PageResult | null>(null);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pendingKeyword, setPendingKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingPage, setLoadingPage] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const fetchResults = useCallback(async (dsId: string, page: number, kw: string) => {
    setLoadingPage(true);
    try {
      const params = new URLSearchParams({ datasetId: dsId, page: String(page) });
      if (kw) params.set('keyword', kw);
      const res = await fetch(`/api/results?${params}`);
      const data: PageResult = await res.json();
      setPageResult(data);
      setCurrentPage(page);
    } catch {
      setError('Erro ao buscar comentários');
    } finally {
      setLoadingPage(false);
    }
  }, []);

  const fetchMeta = useCallback(async (dsId: string, postUrl: string) => {
    try {
      // Para pegar os totais do post (como curtidas globais), usamos a nova rota /api/meta
      // que faz uma chamada sync rápida na task principal do usuário.
      // E pegamos o total extraído chamando results com meta=1
      const [metaRes, statsRes] = await Promise.all([
        fetch(`/api/meta?url=${encodeURIComponent(postUrl)}`),
        fetch(`/api/results?datasetId=${dsId}&meta=1`)
      ]);
      const metaData = await metaRes.json();
      const statsData = await statsRes.json();
      setMeta({ 
        ...metaData, 
        totalItems: statsData.totalItems || 0 
      });
    } catch { /* silente */ }
  }, []);

  const startAnalysis = async () => {
    if (!url) return;
    stopPolling();
    setRunStatus('starting');
    setError('');
    setMeta(null);
    setPageResult(null);
    setItemsScraped(0);
    setSelectedIds(new Set());
    setExpandedRows(new Set());
    setKeyword('');
    setPendingKeyword('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Falha ao iniciar análise');

      const dsId: string = data.datasetId;
      const rId: string = data.runId;
      setDatasetId(dsId);
      setRunStatus('running');

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/status?runId=${rId}`);
          const statusData = await statusRes.json();
          setItemsScraped(statusData.itemCount || 0);

          if (statusData.status === 'SUCCEEDED') {
            stopPolling();
            setRunStatus('succeeded');
            await fetchMeta(dsId, url); // Passa a URL para o fetchMeta buscar no user task
            await fetchResults(dsId, 1, '');
          } else if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(statusData.status)) {
            stopPolling();
            setRunStatus('failed');
            setError(`Scraper encerrou com status: ${statusData.status}`);
          }
        } catch {
          stopPolling();
          setRunStatus('failed');
          setError('Erro ao verificar status do scraper');
        }
      }, 4000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setRunStatus('failed');
      setError(err.message || 'Erro ao iniciar análise');
    }
  };

  const applyKeyword = async () => {
    if (!datasetId) return;
    setKeyword(pendingKeyword);
    setSelectedIds(new Set());
    await fetchResults(datasetId, 1, pendingKeyword);
  };

  const goToPage = async (page: number) => {
    if (!datasetId || loadingPage) return;
    setSelectedIds(new Set());
    setExpandedRows(new Set());
    await fetchResults(datasetId, page, keyword);
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!pageResult) return;
    const allIds = pageResult.comments.map(c => c.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const handleExportSelected = () => {
    if (!pageResult) return;
    exportToCSV(
      pageResult.comments.filter(c => selectedIds.has(c.id)).map(c => ({
        username: c.username, text: c.text, date: c.date, profile_link: c.profile_link, childComments: c.childComments,
      })),
      'selecionados.csv'
    );
  };

  const handleExportPage = () => {
    if (!pageResult) return;
    exportToCSV(
      pageResult.comments.map(c => ({
        username: c.username, text: c.text, date: c.date, profile_link: c.profile_link, childComments: c.childComments,
      })),
      `comentarios_pag${currentPage}.csv`
    );
  };

  const isRunning = runStatus === 'starting' || runStatus === 'running';
  const totalPages = pageResult ? Math.ceil(pageResult.total / pageResult.pageSize) : 0;

  return (
    <div className="min-h-screen font-sans selection:bg-[#dc2743]/50 selection:text-white pb-20 pt-10 md:p-12 relative z-0">
      <div className="max-w-7xl mx-auto space-y-10 px-4 md:px-0">

        {/* Header */}
        <div className="text-center space-y-6 pt-10">
          <div className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-full glass-card mb-4 border border-[#bc1888]/30">
            <Camera className="h-4 w-4 text-[#f09433] animate-pulse" />
            <span className="text-xs font-bold tracking-widest uppercase insta-text-gradient">Scraper Analítico Oficial</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter insta-text-gradient pb-4 drop-shadow-[0_0_20px_rgba(237,73,86,0.3)]">
            Inteligência de Rede
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
            Extração assíncrona de comentários do Instagram com paginação real via dataset Apify.
          </p>

          {/* URL Input */}
          <div className="flex flex-col md:flex-row gap-4 justify-center items-center max-w-3xl mx-auto mt-10 p-2 glass-card rounded-2xl md:rounded-full">
            <div className="flex-1 w-full relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-[#bc1888]/50" />
              </div>
              <Input
                type="url"
                placeholder="Cole um link de Post ou Reels do Instagram..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-16 pl-12 text-lg w-full bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/30"
                onKeyDown={(e) => e.key === 'Enter' && !isRunning && startAnalysis()}
                disabled={isRunning}
              />
            </div>
            <Button
              size="lg"
              className="h-14 px-10 w-full md:w-auto text-lg font-bold rounded-xl md:rounded-full insta-gradient text-white neon-glow border border-white/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
              onClick={startAnalysis}
              disabled={isRunning || !url}
            >
              {isRunning
                ? <><Loader2 className="mr-3 h-6 w-6 animate-spin" />Extraindo...</>
                : 'Analisar Post'
              }
            </Button>
          </div>

          {error && (
            <div className="max-w-2xl mx-auto mt-4 p-4 rounded-xl bg-destructive/20 border border-destructive/50 glass-card text-destructive-foreground">
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Aviso sobre os 15 comentários */}
          <div className="max-w-2xl mx-auto mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/50 glass-card">
            <span className="font-bold text-amber-500 mb-1 block">⚠️ Limite de 15 comentários?</span>
            <span className="text-amber-500/80 text-sm">
              O Instagram trava a extração pública em 1 página (~15). Para raspar os milhares de comentários,
              você <strong>precisa</strong> ir no painel do Apify, editar a sua Task e inserir os seus <strong>loginCookies</strong> de uma conta real. Sem isso, a API bloqueia a paginação.
            </span>
          </div>
        </div>

        {/* Progress - Polling */}
        {isRunning && (
          <div className="space-y-5 pt-4">
            <Card className="glass-card border-[#f09433]/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-[#f09433] animate-spin" />
                  <span className="font-bold text-white">
                    {runStatus === 'starting' ? 'Conectando ao Apify...' : 'Scraper em execução — extraindo comentários'}
                  </span>
                </div>
                <Badge className="bg-[#f09433]/20 text-[#f09433] border-[#f09433]/30 font-bold text-base px-4 py-1">
                  {itemsScraped} extraídos
                </Badge>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full insta-gradient rounded-full transition-all duration-500"
                  style={{ width: itemsScraped > 0 ? '80%' : '20%', animation: 'pulse 2s infinite' }}
                />
              </div>
              <p className="text-white/30 text-sm mt-3">
                Pode levar de 1 a 10 minutos dependendo do volume. Não feche a janela.
              </p>
            </Card>
            <div className="grid md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5 border border-white/10" />)}
            </div>
            <Skeleton className="h-[380px] w-full rounded-3xl bg-white/5 border border-white/10" />
          </div>
        )}

        {/* Dashboard */}
        {runStatus === 'succeeded' && meta && pageResult && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

            {/* Cards de métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-card glass-card-hover border-[#f09433]/20 relative overflow-hidden">
                <CardHeader className="pb-1 pt-5">
                  <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-white/40">
                    <Heart className="h-4 w-4 text-[#dc2743]" /> Curtidas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-black text-white">
                    {meta.likes_count !== null ? meta.likes_count.toLocaleString() : '—'}
                  </p>
                  <p className="text-xs text-white/30 mt-1">total no post</p>
                </CardContent>
              </Card>

              <Card className="glass-card glass-card-hover border-[#bc1888]/20 relative overflow-hidden">
                <CardHeader className="pb-1 pt-5">
                  <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-white/40">
                    <MessageCircle className="h-4 w-4 text-[#bc1888]" /> Extraídos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-black text-white">{meta.totalItems.toLocaleString()}</p>
                  <p className="text-xs text-white/30 mt-1">comentários no dataset</p>
                </CardContent>
              </Card>

              {keyword ? (
                <>
                  <Card className="glass-card glass-card-hover border-[#dc2743]/20 relative overflow-hidden">
                    <CardHeader className="pb-1 pt-5">
                      <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#dc2743]/60">Filtrados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-black text-[#dc2743]">{pageResult.total.toLocaleString()}</p>
                      <p className="text-xs text-white/30 mt-1">de {pageResult.totalAll.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card glass-card-hover border-[#833AB4]/20 relative overflow-hidden">
                    <CardHeader className="pb-1 pt-5">
                      <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#833AB4]/60">Ocorrências</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-black text-[#833AB4]">{pageResult.occurrences.toLocaleString()}</p>
                      <p className="text-xs text-white/30 mt-1">incluindo respostas</p>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  <Card className="glass-card glass-card-hover border-white/10 relative overflow-hidden">
                    <CardHeader className="pb-1 pt-5">
                      <CardTitle className="text-xs font-bold tracking-widest uppercase text-white/40">Página Atual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-black text-white">{currentPage}</p>
                      <p className="text-xs text-white/30 mt-1">de {totalPages} páginas</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card glass-card-hover border-white/10 relative overflow-hidden">
                    <CardHeader className="pb-1 pt-5">
                      <CardTitle className="text-xs font-bold tracking-widest uppercase text-white/40">Selecionados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-black text-white">{selectedIds.size}</p>
                      <p className="text-xs text-white/30 mt-1">na página</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Busca por palavra-chave */}
            <div className="glass-card p-2 rounded-2xl flex flex-col md:flex-row gap-3 items-center">
              <div className="flex-1 w-full flex items-center gap-3 pl-4">
                <Filter className="h-5 w-5 text-[#f09433] flex-shrink-0" />
                <Input
                  placeholder="Buscar em TODOS os comentários extraídos (pai + respostas)..."
                  value={pendingKeyword}
                  onChange={(e) => setPendingKeyword(e.target.value)}
                  className="h-12 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/30 text-base"
                  onKeyDown={(e) => e.key === 'Enter' && applyKeyword()}
                />
              </div>
              <Button
                className="h-12 px-8 rounded-xl insta-gradient text-white font-bold w-full md:w-auto"
                onClick={applyKeyword}
                disabled={loadingPage}
              >
                {loadingPage && keyword !== pendingKeyword
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : 'Buscar Total'
                }
              </Button>
              {keyword && (
                <Button
                  variant="outline"
                  className="h-12 px-4 rounded-xl bg-white/5 border-white/10 text-white/60 w-full md:w-auto"
                  onClick={() => { setPendingKeyword(''); setKeyword(''); fetchResults(datasetId, 1, ''); }}
                >
                  Limpar filtro
                </Button>
              )}
            </div>

            {/* Tabela */}
            <Card className="glass-card border-white/10 overflow-hidden shadow-2xl rounded-3xl">
              <div className="flex flex-col md:flex-row justify-between items-center p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <FileText className="h-6 w-6 text-[#dc2743]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Comentários</h3>
                    <p className="text-sm text-white/40">
                      Pág. {currentPage}/{totalPages} · {pageResult.total.toLocaleString()} comentário{pageResult.total !== 1 ? 's' : ''}
                      {keyword && ` — filtrado por "${keyword}"`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <Button
                    variant="outline"
                    className="flex-1 md:flex-none h-12 rounded-xl bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 disabled:opacity-30"
                    onClick={handleExportSelected}
                    disabled={selectedIds.size === 0}
                  >
                    <Download className="mr-2 h-4 w-4 text-[#bc1888]" /> Selecionados ({selectedIds.size})
                  </Button>
                  <Button
                    className="flex-1 md:flex-none h-12 rounded-xl insta-gradient text-white border border-white/20 insta-gradient-hover"
                    onClick={handleExportPage}
                  >
                    <Download className="mr-2 h-4 w-4" /> Exportar Página
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {loadingPage ? (
                  <div className="p-6 space-y-3">
                    {[...Array(10)].map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full bg-white/5 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <Table className="w-full">
                    <TableHeader className="bg-white/[0.02]">
                      <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="w-10 pl-4">
                          <Checkbox
                            checked={pageResult.comments.length > 0 && pageResult.comments.every(c => selectedIds.has(c.id))}
                            onCheckedChange={toggleSelectAll}
                            className="border-[#dc2743] data-[state=checked]:bg-[#dc2743]"
                          />
                        </TableHead>
                        <TableHead className="text-[#f09433] font-bold uppercase tracking-widest text-xs">Usuário</TableHead>
                        <TableHead className="text-[#f09433] font-bold uppercase tracking-widest text-xs">Comentário</TableHead>
                        <TableHead className="text-[#f09433] font-bold uppercase tracking-widest text-xs">Data</TableHead>
                        <TableHead className="text-[#f09433] font-bold uppercase tracking-widest text-xs text-center">❤️</TableHead>
                        <TableHead className="text-[#f09433] font-bold uppercase tracking-widest text-xs text-center">
                          <MessageCircle className="h-4 w-4 inline" />
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageResult.comments.length > 0 ? (
                        pageResult.comments.map((comment) => {
                          const isExpanded = expandedRows.has(comment.id);
                          const isSelected = selectedIds.has(comment.id);
                          return (
                            <TableRow
                              key={comment.id}
                              className={`border-white/5 transition-colors ${isSelected ? 'bg-[#dc2743]/10' : 'hover:bg-white/[0.03]'}`}
                            >
                              <TableCell className="pl-4 align-top pt-5">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(comment.id)}
                                  className="border-[#dc2743] data-[state=checked]:bg-[#dc2743]"
                                />
                              </TableCell>
                              <TableCell className="align-top pt-5">
                                <div className="flex items-center gap-3">
                                  <div className="relative flex-shrink-0">
                                    <div className="absolute inset-0 rounded-full insta-gradient blur-[2px] opacity-60" />
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img className="relative h-9 w-9 rounded-full object-cover border border-white/10" src={comment.avatar} alt={comment.username} />
                                  </div>
                                  <a
                                    href={comment.profile_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-[#f09433] hover:text-[#dc2743] transition-colors text-sm whitespace-nowrap"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    @{comment.username}
                                  </a>
                                </div>
                              </TableCell>
                              <TableCell
                                className="align-top pt-4 max-w-md cursor-pointer"
                                onClick={() => toggleRow(comment.id)}
                              >
                                <div className="space-y-1">
                                  {isExpanded
                                    ? <p className="text-white/90 leading-relaxed whitespace-pre-wrap break-words">{comment.text}</p>
                                    : <p className="text-muted-foreground/90 leading-relaxed line-clamp-2 max-w-[360px]">{comment.text}</p>
                                  }
                                  <span className="inline-flex items-center gap-1 text-[#f09433]/50 text-xs font-medium">
                                    {isExpanded
                                      ? <><ChevronUp className="h-3 w-3" /> Recolher</>
                                      : <><ChevronDown className="h-3 w-3" /> Expandir</>
                                    }
                                  </span>
                                  {/* Respostas ao expandir */}
                                  {isExpanded && comment.childComments.length > 0 && (
                                    <div className="mt-3 pl-4 border-l-2 border-[#bc1888]/40 space-y-3">
                                      {comment.childComments.map((child) => (
                                        <div key={child.id} className="flex gap-3 items-start">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            className="h-7 w-7 rounded-full object-cover flex-shrink-0 border border-white/10 mt-0.5"
                                            src={child.ownerProfilePicUrl}
                                            alt={child.ownerUsername}
                                          />
                                          <div className="space-y-0.5 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <a
                                                href={`https://instagram.com/${child.ownerUsername}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold text-[#f09433]/80 hover:text-[#f09433]"
                                                onClick={e => e.stopPropagation()}
                                              >
                                                @{child.ownerUsername}
                                              </a>
                                              <span className="text-[10px] text-white/30">
                                                {new Date(child.timestamp).toLocaleDateString()}
                                              </span>
                                              <span className="inline-flex items-center gap-1 text-[10px] text-red-400/70">
                                                <Heart className="h-2.5 w-2.5" />{child.likesCount}
                                              </span>
                                            </div>
                                            <p className="text-xs text-white/70 leading-relaxed break-words">{child.text}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="align-top pt-5 whitespace-nowrap text-sm text-muted-foreground/70">
                                {new Date(comment.date).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="align-top pt-5 text-center">
                                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 font-bold">
                                  {comment.likesCount}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top pt-5 text-center">
                                <Badge
                                  variant="outline"
                                  className={`font-bold ${comment.repliesCount > 0 ? 'bg-[#833AB4]/10 text-[#833AB4] border-[#833AB4]/20' : 'bg-white/5 text-white/30 border-white/10'}`}
                                >
                                  {comment.repliesCount}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-48 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <Camera className="h-8 w-8 text-white/20" />
                              <p className="text-white/40">Nenhum comentário encontrado</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Paginação */}
              <div className="p-5 flex flex-col md:flex-row items-center justify-between border-t border-white/5 bg-black/20 gap-4">
                <span className="text-sm text-white/40">
                  Mostrando{' '}
                  <span className="font-bold text-white/70">
                    {((currentPage - 1) * 10) + 1}–{Math.min(currentPage * 10, pageResult.total)}
                  </span>{' '}
                  de <span className="font-bold text-[#dc2743]">{pageResult.total.toLocaleString()}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-10 px-4 rounded-xl bg-white/5 border-white/10 text-white hover:bg-[#dc2743]/20 hover:text-[#dc2743] hover:border-[#dc2743]/50 font-bold disabled:opacity-30"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage <= 1 || loadingPage}
                  >
                    ← Anterior
                  </Button>
                  <span className="text-white/40 text-sm px-2">{currentPage} / {totalPages}</span>
                  <Button
                    variant="outline"
                    className="h-10 px-4 rounded-xl bg-white/5 border-white/10 text-white hover:bg-[#833AB4]/20 hover:text-[#833AB4] hover:border-[#833AB4]/50 font-bold disabled:opacity-30"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={!pageResult.hasMore || loadingPage}
                  >
                    Próxima →
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
