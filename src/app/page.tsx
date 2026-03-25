'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  RefreshCw, XCircle, Layers, ListFilter,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

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
  comment_id: string;
  avatar: string;
  username: string;
  text: string;
  date: string;
  likesCount: number;
  repliesCount: number;
  childComments: ChildComment[];
  profile_link: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract shortcode from an Instagram URL or return the string as-is */
function extractShortcode(input: string): string {
  const match = input.match(/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_\-]+)/);
  if (match) return match[1];
  // Bare shortcode
  return input.trim();
}

/** Returns true if the string contains only emoji / whitespace (no alphanumeric) */
function isEmojiOnly(text: string): boolean {
  return !/[a-zA-Z0-9\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/.test(text) && text.trim().length > 0;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  // Input
  const [url, setUrl] = useState('');

  // Loading states
  const [loadingFirst, setLoadingFirst] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  // Data
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [paginationToken, setPaginationToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Filters (client-side)
  const [searchQuery, setSearchQuery] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [filterEmojis, setFilterEmojis] = useState(false);

  // UI state
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loadAllProgress, setLoadAllProgress] = useState(0);
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  // post_id (numeric media id) needed to fetch child comments
  const [postId, setPostId] = useState<string | null>(null);
  const postIdRef = useRef<string | null>(null);

  // Refs
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<boolean>(false); // prevent double-fire from observer
  const shortcodeRef = useRef<string>('');
  const loadAllCancelRef = useRef<boolean>(false);

  // ── Filtered comments (client-side) ──────────────────────────────────────

  const filteredComments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const blackTerms = blacklist
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    return allComments.filter(c => {
      // Keyword / username search
      if (q) {
        const matchText = c.text.toLowerCase().includes(q);
        const matchUser = c.username.toLowerCase().includes(q.replace(/^@/, ''));
        if (!matchText && !matchUser) return false;
      }

      // Blacklist
      if (blackTerms.length > 0) {
        const lower = c.text.toLowerCase();
        if (blackTerms.some(term => lower.includes(term.toLowerCase()))) return false;
      }

      // Emoji-only filter
      if (filterEmojis && isEmojiOnly(c.text)) return false;

      return true;
    });
  }, [allComments, searchQuery, blacklist, filterEmojis]);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (shortcode: string, token: string | null) => {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcode, pagination_token: token }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro HTTP ${res.status}`);
    }

    return res.json() as Promise<{
      comments: Comment[];
      pagination_token: string | null;
      post_id: string | null;
      count: number;
    }>;
  }, []);

  // ── Start analysis ────────────────────────────────────────────────────────

  const startAnalysis = async () => {
    if (!url || loadingFirst) return;

    const shortcode = extractShortcode(url);
    shortcodeRef.current = shortcode;

    setLoadingFirst(true);
    setError('');
    setAllComments([]);
    setPaginationToken(null);
    setHasMore(false);
    setSelectedIds(new Set());
    setExpandedRows(new Set());
    setSearchQuery('');
    setBlacklist('');
    setFilterEmojis(false);
    setLoadAllProgress(0);
    loadAllCancelRef.current = false;

    try {
      const data = await fetchPage(shortcode, null);
      setAllComments(data.comments);
      const more = !!data.pagination_token && data.comments.length >= 15;
      setPaginationToken(more ? data.pagination_token : null);
      setHasMore(more);
      // Capture post_id from first response
      if (data.post_id) {
        setPostId(data.post_id);
        postIdRef.current = data.post_id;
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Erro ao buscar comentários');
    } finally {
      setLoadingFirst(false);
    }
  };

  // ── Load more (scroll / button) ───────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (loadMoreRef.current || loadingMore || !hasMore || !paginationToken) return;
    loadMoreRef.current = true;
    setLoadingMore(true);

    try {
      const data = await fetchPage(shortcodeRef.current, paginationToken);
      setAllComments(prev => [...prev, ...data.comments]);
      const more = !!data.pagination_token && data.comments.length >= 15;
      setPaginationToken(more ? data.pagination_token : null);
      setHasMore(more);
      // Keep post_id in sync across pages
      if (data.post_id && !postIdRef.current) {
        setPostId(data.post_id);
        postIdRef.current = data.post_id;
      }
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
      loadMoreRef.current = false;
    }
  }, [fetchPage, hasMore, loadingMore, paginationToken]);

  // ── Intersection Observer for infinite scroll ─────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loadingAll) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadingAll, loadMore]);

  // ── Load All ──────────────────────────────────────────────────────────────

  const loadAll = async () => {
    if (loadingAll || !hasMore) return;
    setLoadingAll(true);
    loadAllCancelRef.current = false;
    let token = paginationToken;
    let totalLoaded = allComments.length;
    setLoadAllProgress(totalLoaded);

    try {
      while (token && !loadAllCancelRef.current) {
        await new Promise(r => setTimeout(r, 600)); // rate-limit delay
        const data = await fetchPage(shortcodeRef.current, token);
        setAllComments(prev => [...prev, ...data.comments]);
        totalLoaded += data.comments.length;
        setLoadAllProgress(totalLoaded);
        token = data.comments.length >= 15 ? data.pagination_token : null;
        setPaginationToken(token);
        setHasMore(!!token);
      }
    } catch {
      // silent
    } finally {
      setLoadingAll(false);
    }
  };

  const cancelLoadAll = () => {
    loadAllCancelRef.current = true;
    setLoadingAll(false);
  };

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = filteredComments.map(c => c.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  // ── Expand rows ───────────────────────────────────────────────────────────

  // ── Expand rows & fetch replies ───────────────────────────────────────────

  const toggleRow = async (commentId: string) => {
    const isExpanded = expandedRows.has(commentId);
    
    // Se está recolhendo (fechando), apenas atualize o set
    if (isExpanded) {
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      return;
    }

    // Se está expandindo (abrindo), marque como expandido com antecedência para abrir o dropdown
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.add(commentId);
      return next;
    });

    const targetComment = allComments.find(c => c.id === commentId);
    if (!targetComment || targetComment.childComments.length > 0 || !postIdRef.current) {
      return; // Já tem respostas ou não achou post_id
    }

    // Marca como loading
    setLoadingReplies(prev => {
      const next = new Set(prev);
      next.add(commentId);
      return next;
    });

    try {
      const res = await fetch(`/api/replies?post_id=${postIdRef.current}&comment_id=${targetComment.comment_id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.replies) {
          // Atualiza array allComments com as respostas injetadas no respectivo comentário
          setAllComments(prevAll => prevAll.map(c => 
            c.id === commentId ? { ...c, childComments: data.replies } : c
          ));
        }
      }
    } catch {
      // Falha silenciosa
    } finally {
      setLoadingReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExportSelected = () => {
    const filename = `${postIdRef.current || shortcodeRef.current || 'export'}_selecionados.csv`;
    exportToCSV(
      filteredComments
        .filter(c => selectedIds.has(c.id))
        .map(c => ({
          username: c.username, text: c.text, date: c.date, likesCount: c.likesCount, profile_link: c.profile_link, childComments: c.childComments
        })),
      filename
    );
  };

  const handleExportAll = () => {
    const filename = `${postIdRef.current || shortcodeRef.current || 'export'}_filtrados.csv`;
    exportToCSV(
      filteredComments.map(c => ({
        username: c.username, text: c.text, date: c.date, likesCount: c.likesCount, profile_link: c.profile_link, childComments: c.childComments,
      })),
      filename
    );
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const isLoading = loadingFirst;
  const hasData = allComments.length > 0;
  const filtersActive = searchQuery || blacklist || filterEmojis;

  return (
    <div className="min-h-screen font-sans selection:bg-[#dc2743]/50 selection:text-white pb-20 pt-10 md:p-12 relative z-0">
      <div className="max-w-7xl mx-auto space-y-10 px-4 md:px-0">

        {/* ── Header ── */}
        <div className="text-center space-y-6 pt-10">
          <div className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-full glass-card mb-4 border border-[#bc1888]/30">
            <Camera className="h-4 w-4 text-[#f09433] animate-pulse" />
            <span className="text-xs font-bold tracking-widest uppercase insta-text-gradient">Scraper Analítico — RapidAPI</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter insta-text-gradient pb-4 drop-shadow-[0_0_20px_rgba(237,73,86,0.3)]">
            Inteligência de Rede
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
            Extração de comentários do Instagram com scroll infinito, paginação por token e filtros reativos.
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
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && startAnalysis()}
                disabled={isLoading}
              />
            </div>
            <Button
              size="lg"
              className="h-14 px-10 w-full md:w-auto text-lg font-bold rounded-xl md:rounded-full insta-gradient text-white neon-glow border border-white/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
              onClick={startAnalysis}
              disabled={isLoading || !url}
            >
              {isLoading
                ? <><Loader2 className="mr-3 h-6 w-6 animate-spin" />Carregando...</>
                : 'Analisar Post'
              }
            </Button>
          </div>

          {error && (
            <div className="max-w-2xl mx-auto mt-4 p-4 rounded-xl bg-destructive/20 border border-destructive/50 glass-card text-destructive-foreground">
              <span className="font-semibold">{error}</span>
            </div>
          )}
        </div>

        {/* ── Loading skeleton ── */}
        {isLoading && (
          <div className="space-y-5 pt-4">
            <Card className="glass-card border-[#f09433]/30 p-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-[#f09433] animate-spin" />
                <span className="font-bold text-white">Buscando comentários via RapidAPI...</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-4">
                <div className="h-full insta-gradient rounded-full" style={{ width: '40%', animation: 'pulse 2s infinite' }} />
              </div>
            </Card>
            <div className="grid md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/5 border border-white/10" />)}
            </div>
            <Skeleton className="h-[380px] w-full rounded-3xl bg-white/5 border border-white/10" />
          </div>
        )}

        {/* ── Dashboard ── */}
        {hasData && !isLoading && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-card glass-card-hover border-[#bc1888]/20 relative overflow-hidden">
                <CardHeader className="pb-1 pt-5">
                  <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-white/40">
                    <MessageCircle className="h-4 w-4 text-[#bc1888]" /> Carregados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-black text-white">{allComments.length.toLocaleString()}</p>
                  <p className="text-xs text-white/30 mt-1">comentários na memória</p>
                </CardContent>
              </Card>

              <Card className="glass-card glass-card-hover border-[#dc2743]/20 relative overflow-hidden">
                <CardHeader className="pb-1 pt-5">
                  <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-white/40">
                    <ListFilter className="h-4 w-4 text-[#dc2743]" /> Exibindo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-black text-[#dc2743]">{filteredComments.length.toLocaleString()}</p>
                  <p className="text-xs text-white/30 mt-1">
                    {filtersActive ? `de ${allComments.length.toLocaleString()} filtrados` : 'sem filtros ativos'}
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card glass-card-hover border-[#833AB4]/20 relative overflow-hidden">
                <CardHeader className="pb-1 pt-5">
                  <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-white/40">
                    <Layers className="h-4 w-4 text-[#833AB4]" /> Selecionados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-black text-[#833AB4]">{selectedIds.size}</p>
                  <p className="text-xs text-white/30 mt-1">para exportar</p>
                </CardContent>
              </Card>

              <Card className="glass-card glass-card-hover border-[#f09433]/20 relative overflow-hidden">
                <CardHeader className="pb-1 pt-5">
                  <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-white/40">
                    <Heart className="h-4 w-4 text-[#f09433]" /> Mais páginas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-black text-white">{hasMore ? 'Sim' : 'Não'}</p>
                  <p className="text-xs text-white/30 mt-1">{hasMore ? 'scroll para carregar' : 'tudo carregado'}</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Filters ── */}
            <Card className="glass-card border-white/10 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-5 w-5 text-[#f09433]" />
                <span className="font-bold text-white text-base">Filtros Reativos</span>
                <span className="text-xs text-white/30 ml-1">(aplicados sobre dados já carregados)</span>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Search query */}
                <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 border border-white/10">
                  <Search className="h-4 w-4 text-[#f09433] flex-shrink-0" />
                  <Input
                    placeholder="Buscar por texto ou @usuário..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-12 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/30"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-white/40 hover:text-white/80 transition-colors">
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Blacklist */}
                <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 border border-white/10">
                  <XCircle className="h-4 w-4 text-[#dc2743] flex-shrink-0" />
                  <Input
                    placeholder="Blacklist: palavras, emojis (separados por vírgula)..."
                    value={blacklist}
                    onChange={e => setBlacklist(e.target.value)}
                    className="h-12 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/30"
                  />
                  {blacklist && (
                    <button onClick={() => setBlacklist('')} className="text-white/40 hover:text-white/80 transition-colors">
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Emoji-only checkbox */}
              <div className="flex items-center gap-3 pt-1">
                <Checkbox
                  id="emoji-filter"
                  checked={filterEmojis}
                  onCheckedChange={(v) => setFilterEmojis(!!v)}
                  className="border-[#bc1888] data-[state=checked]:bg-[#bc1888]"
                />
                <label
                  htmlFor="emoji-filter"
                  className="text-sm text-white/70 cursor-pointer select-none"
                >
                  Ocultar comentários com <strong>apenas emojis</strong> (sem texto alfanumérico)
                </label>
              </div>
            </Card>

            {/* ── Load all / progress ── */}
            {(hasMore || loadingAll) && (
              <div className="flex flex-col md:flex-row items-center gap-4 glass-card border-white/10 p-4 rounded-2xl">
                <div className="flex-1">
                  {loadingAll ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#f09433]" />
                        <span className="text-sm text-white/70">
                          Carregando tudo... <strong className="text-white">{loadAllProgress}</strong> comentários carregados
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full insta-gradient rounded-full transition-all duration-300" style={{ width: '60%', animation: 'pulse 1.5s infinite' }} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-white/50">
                      {allComments.length.toLocaleString()} comentários carregados — há mais páginas disponíveis
                    </p>
                  )}
                </div>
                {loadingAll ? (
                  <Button
                    variant="outline"
                    className="h-10 px-6 rounded-xl bg-white/5 border-white/10 text-white/70 hover:bg-red-500/20 hover:text-red-400"
                    onClick={cancelLoadAll}
                  >
                    Cancelar
                  </Button>
                ) : (
                  <Button
                    className="h-10 px-6 rounded-xl insta-gradient text-white font-bold"
                    onClick={loadAll}
                    disabled={loadingMore}
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    Carregar Tudo
                  </Button>
                )}
              </div>
            )}

            {/* ── Table ── */}
            <Card className="glass-card border-white/10 overflow-hidden shadow-2xl rounded-3xl">
              <div className="flex flex-col md:flex-row justify-between items-center p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <FileText className="h-6 w-6 text-[#dc2743]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Comentários</h3>
                    <p className="text-sm text-white/40">
                      Exibindo{' '}
                      <span className="text-white font-bold">{filteredComments.length.toLocaleString()}</span>
                      {' '}de{' '}
                      <span className="text-[#dc2743] font-bold">{allComments.length.toLocaleString()}</span>
                      {' '}comentários carregados
                      {filtersActive && ' (com filtros ativos)'}
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
                    onClick={handleExportAll}
                  >
                    <Download className="mr-2 h-4 w-4" /> Exportar Filtrados
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-white/[0.02]">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={filteredComments.length > 0 && filteredComments.every(c => selectedIds.has(c.id))}
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
                    {filteredComments.length > 0 ? (
                      filteredComments.map((comment) => {
                        const isExpanded = expandedRows.has(comment.id);
                        const isSelected = selectedIds.has(comment.id);
                        const hasReplies = comment.repliesCount > 0;

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

                            {/* Username */}
                            <TableCell className="align-top pt-5">
                              <div className="flex items-center gap-3">
                                <div className="relative flex-shrink-0">
                                  <div className="absolute inset-0 rounded-full insta-gradient blur-[2px] opacity-60" />
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    className="relative h-9 w-9 rounded-full object-cover border border-white/10"
                                    src={comment.avatar}
                                    alt={comment.username}
                                  />
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

                            {/* Comment text — always full, no truncation */}
                            <TableCell className="align-top pt-4 max-w-md">
                              <div className="space-y-2">
                                <p className="text-white/90 leading-relaxed whitespace-pre-wrap break-words">
                                  {comment.text}
                                </p>

                                {/* "Expandir" button: only shown if there are replies */}
                                {hasReplies && (
                                  <button
                                    onClick={() => toggleRow(comment.id)}
                                    className="inline-flex items-center gap-1 text-[#f09433]/60 hover:text-[#f09433] text-xs font-medium transition-colors"
                                    disabled={loadingReplies.has(comment.id)}
                                  >
                                    {loadingReplies.has(comment.id) ? (
                                      <><Loader2 className="h-3 w-3 animate-spin" /> Carregando resps...</>
                                    ) : isExpanded ? (
                                      <><ChevronUp className="h-3 w-3" /> Recolher respostas</>
                                    ) : (
                                      <><ChevronDown className="h-3 w-3" /> Ver {comment.repliesCount} resposta{comment.repliesCount !== 1 ? 's' : ''}</>
                                    )}
                                  </button>
                                )}

                                {/* Child comments */}
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
                                            <span className="text-[10px] text-white/30">{child.timestamp}</span>
                                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400/70">
                                              <Heart className="h-2.5 w-2.5" />{child.likesCount}
                                            </span>
                                          </div>
                                          <p className="text-xs text-white/70 leading-relaxed break-words whitespace-pre-wrap">
                                            {child.text}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Date */}
                            <TableCell className="align-top pt-5 whitespace-nowrap text-sm text-muted-foreground/70">
                              {comment.date}
                            </TableCell>

                            {/* Likes */}
                            <TableCell className="align-top pt-5 text-center">
                              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 font-bold">
                                {comment.likesCount}
                              </Badge>
                            </TableCell>

                            {/* Replies count */}
                            <TableCell className="align-top pt-5 text-center">
                              <Badge
                                variant="outline"
                                className={`font-bold ${hasReplies ? 'bg-[#833AB4]/10 text-[#833AB4] border-[#833AB4]/20' : 'bg-white/5 text-white/30 border-white/10'}`}
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
                            <p className="text-white/40">
                              {filtersActive
                                ? 'Nenhum comentário corresponde aos filtros ativos'
                                : 'Nenhum comentário encontrado'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Infinite scroll sentinel + load more feedback */}
              <div ref={sentinelRef} className="h-4" />
              {loadingMore && (
                <div className="flex items-center justify-center gap-3 py-6 border-t border-white/5">
                  <Loader2 className="h-5 w-5 animate-spin text-[#f09433]" />
                  <span className="text-sm text-white/50">Carregando mais comentários...</span>
                </div>
              )}
              {!hasMore && allComments.length > 0 && (
                <div className="flex items-center justify-center py-5 border-t border-white/5">
                  <span className="text-xs text-white/30 font-medium tracking-widest uppercase">
                    ✓ Todos os {allComments.length.toLocaleString()} comentários carregados
                  </span>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
