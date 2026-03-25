'use client';

import React, { useState, useMemo } from 'react';
import { useReactTable, getCoreRowModel, getPaginationRowModel, getSortedRowModel, flexRender, SortingState, ColumnDef } from '@tanstack/react-table';
import { exportToCSV } from '@/lib/export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Download, Loader2, PlayCircle, Heart, MessageCircle, ArrowUpDown, Filter, FileText, Camera, ChevronDown, ChevronUp } from 'lucide-react';

interface Comment {
  id: string;
  avatar: string;
  username: string;
  text: string;
  date: string;
  likes: number;
  replies: number;
  profile_link: string;
}

interface AnalysisData {
  owner_name: string;
  likes_count: number;
  comments_count: number;
  video_url?: string;
  thumbnail_url?: string;
  caption: string;
  comments: Comment[];
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState('');

  // Table states
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});
  const [keyword, setKeyword] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const analyzeUrl = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Falha ao processar a URL do Instagram');
      }

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }
      
      setData(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const filteredComments = useMemo(() => {
    if (!data?.comments) return [];
    if (!keyword) return data.comments;
    const lowerKeyword = keyword.toLowerCase();
    return data.comments.filter(c => c.text.toLowerCase().includes(lowerKeyword));
  }, [data?.comments, keyword]);

  const columns = useMemo<ColumnDef<Comment>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="border-[#dc2743] data-[state=checked]:bg-[#dc2743] data-[state=checked]:text-white translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="border-[#dc2743] data-[state=checked]:bg-[#dc2743] data-[state=checked]:text-white translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'username',
      header: 'Usuário',
      cell: ({ row }) => (
        <div className="flex items-center gap-4 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="relative">
             <div className="absolute inset-0 rounded-full insta-gradient blur-[2px] opacity-70"></div>
             <img className="relative h-10 w-10 rounded-full bg-muted object-cover border border-white/10" src={row.original.avatar} alt="Avatar" />
          </div>
          <a href={row.original.profile_link} target="_blank" rel="noreferrer" className="font-semibold text-[#f09433] hover:text-[#dc2743] transition-colors">
            @{row.getValue('username')}
          </a>
        </div>
      )
    },
    {
      accessorKey: 'text',
      header: 'Comentário',
      cell: ({ row }) => {
        const isExpanded = expandedRows.has(row.id);
        const text: string = row.getValue('text');
        return (
          <div
            className="max-w-[420px] cursor-pointer select-none"
            onClick={() => toggleRow(row.id)}
            title={isExpanded ? 'Clique para recolher' : 'Clique para expandir'}
          >
            {isExpanded ? (
              <p className="text-white/90 leading-relaxed whitespace-pre-wrap break-words">{text}</p>
            ) : (
              <p className="text-muted-foreground/90 leading-relaxed truncate">{text}</p>
            )}
            <span className="inline-flex items-center gap-1 text-[#f09433]/60 text-xs mt-1 font-medium">
              {isExpanded
                ? <><ChevronUp className="h-3 w-3" /> Recolher</>
                : <><ChevronDown className="h-3 w-3" /> Expandir</>}
            </span>
          </div>
        );
      }
    },
    {
      accessorKey: 'date',
      header: 'Data',
      cell: ({ row }) => {
        const date = new Date(row.getValue('date'));
        return <span className="text-muted-foreground/70 whitespace-nowrap text-sm font-medium">{date.toLocaleDateString()}</span>;
      }
    },
    {
      accessorKey: 'likes',
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-[#dc2743]/10 hover:text-[#dc2743] transition-colors">
              <Heart className="mr-2 h-4 w-4" />Curtidas <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )
      },
      cell: ({ row }) => (
          <div className="text-center w-full">
             <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 font-bold px-3 py-1">
                {row.getValue('likes')}
             </Badge>
          </div>
      )
    },
    {
      accessorKey: 'replies',
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="hover:bg-[#833AB4]/10 hover:text-[#833AB4] transition-colors">
              <MessageCircle className="mr-2 h-4 w-4" />Respostas <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )
      },
      cell: ({ row }) => (
         <div className="text-center w-full">
             <Badge variant="outline" className="bg-[#833AB4]/10 text-[#833AB4] border-[#833AB4]/20 font-bold px-3 py-1">
                {row.getValue('replies')}
             </Badge>
          </div>
      ),
    }
  ], []);

  const table = useReactTable({
    data: filteredComments,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    }
  });

  const occurrencesCount = useMemo(() => {
    if (!data?.comments || !keyword) return 0;
    const lowerKeyword = keyword.toLowerCase();
    return data.comments.reduce((count, comment) => {
      const regex = new RegExp(lowerKeyword, 'gi');
      const matches = comment.text.match(regex);
      return count + (matches?.length || 0);
    }, 0);
  }, [data?.comments, keyword]);

  const handleExportSelected = () => {
    const selectedData = table.getFilteredSelectedRowModel().rows.map(row => ({
      Nome: row.original.username,
      Usuário: row.original.username,
      "Texto do Comentário": row.original.text,
      Data: row.original.date,
      "Link do Perfil": row.original.profile_link
    }));
    exportToCSV(selectedData, 'comentarios_selecionados.csv');
  };

  const handleExportAll = () => {
    const allData = filteredComments.map(c => ({
      Nome: c.username,
      Usuário: c.username,
      "Texto do Comentário": c.text,
      Data: c.date,
      "Link do Perfil": c.profile_link
    }));
    exportToCSV(allData, 'todos_os_comentarios.csv');
  };

  return (
    <div className="min-h-screen font-sans selection:bg-[#dc2743]/50 selection:text-white pb-20 pt-10 md:p-12 relative z-0">
      
      {/* Container Principal */}
      <div className="max-w-7xl mx-auto space-y-12 px-4 md:px-0">
        
        {/* Header / Input */}
        <div className="text-center space-y-6 pt-10">
          <div className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-full glass-card mb-4 border border-[#bc1888]/30">
             <Camera className="h-4 w-4 text-[#f09433] animate-pulse" />
             <span className="text-xs font-bold tracking-widest uppercase insta-text-gradient">Scraper Analítico Oficial</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter insta-text-gradient pb-4 drop-shadow-[0_0_20px_rgba(237,73,86,0.3)]">
            Inteligência de Rede
          </h1>
          
          <p className="text-white/60 text-lg md:text-xl font-light max-w-2xl mx-auto leading-relaxed">
            Obtenha insights de comentários do Instagram. Processamento ultrarrápido impulsionado pelas cores que você já conhece.
          </p>

          {/* Search Box Glassmorphism */}
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
                 className="h-16 pl-12 text-lg w-full bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/30 truncate"
                 onKeyDown={(e) => e.key === 'Enter' && analyzeUrl()}
               />
            </div>
            
            <Button
              size="lg"
              className="h-14 px-10 w-full md:w-auto text-lg font-bold rounded-xl md:rounded-full insta-gradient insta-gradient-hover text-white transition-all transform hover:scale-105 active:scale-95 neon-glow border border-white/20"
              onClick={analyzeUrl}
              disabled={loading || !url}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  Carregando...
                </>
              ) : (
                'Analisar Post'
              )}
            </Button>
          </div>
          {error && (
             <div className="max-w-2xl mx-auto mt-4 p-4 rounded-xl bg-destructive/20 border border-destructive/50 text-destructive-foreground flex items-center justify-center gap-3 glass-card shadow-[0_0_20px_rgba(255,0,0,0.2)]">
                <span className="font-semibold text-lg">{error}</span>
             </div>
          )}
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-8 pt-10 animate-pulse">
            <div className="grid md:grid-cols-3 gap-8">
              <Skeleton className="h-[300px] rounded-3xl col-span-1 bg-white/5 border border-white/10" />
              <div className="col-span-2 space-y-6 flex flex-col justify-center">
                <Skeleton className="h-14 w-3/4 bg-white/5 rounded-full" />
                <Skeleton className="h-6 w-1/4 bg-white/5 rounded-full" />
                <div className="flex gap-4 pt-6">
                   <Skeleton className="h-32 w-full bg-[#f09433]/10 rounded-2xl border border-[#f09433]/20" />
                   <Skeleton className="h-32 w-full bg-[#833AB4]/10 rounded-2xl border border-[#833AB4]/20" />
                </div>
              </div>
            </div>
            <Skeleton className="h-[500px] w-full rounded-3xl bg-white/5 border border-white/10 mt-12" />
          </div>
        )}

        {/* Dashboard Section */}
        {data && !loading && (
          <div className="space-y-10 pt-10 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            
            {/* Summary & Media */}
            <div className="grid md:grid-cols-3 gap-8 items-stretch">
              {/* Media Card */}
              <Card className="col-span-1 glass-card overflow-hidden group border-white/10 p-1 flex flex-col h-[350px]">
                <div className="relative w-full h-full rounded-[14px] overflow-hidden bg-black flex items-center justify-center group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.thumbnail_url || 'https://via.placeholder.com/400'}
                    alt="Thumbnail"
                    className="object-cover w-full h-full group-hover:scale-110 group-hover:rotate-1 transition-all duration-700 opacity-80 group-hover:opacity-100"
                  />
                  {/* Glow overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-[#dc2743]/10 to-transparent opacity-80" />
                  
                  {data.video_url && (
                    <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px] bg-black/30 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
                      <PlayCircle className="text-white h-20 w-20 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                    </div>
                  )}
                  
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
                     <Badge className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border-white/20 font-bold px-3 py-1">
                        Mídia Capturada
                     </Badge>
                     {data.video_url ? (
                      <a href={data.video_url} target="_blank" rel="noreferrer" title="Baixar Vídeo">
                        <Button size="icon" className="h-10 w-10 bg-[#dc2743]/80 hover:bg-[#dc2743] text-white backdrop-blur-md border-white/30 rounded-full transition-all hover:scale-110">
                          <Download className="h-5 w-5" />
                        </Button>
                      </a>
                    ) : (
                      <a href={data.thumbnail_url} target="_blank" rel="noreferrer" title="Baixar Imagem">
                        <Button size="icon" className="h-10 w-10 bg-[#dc2743]/80 hover:bg-[#dc2743] text-white backdrop-blur-md border-white/30 rounded-full transition-all hover:scale-110">
                          <Download className="h-5 w-5" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </Card>

              {/* Data Cards */}
              <div className="col-span-2 flex flex-col justify-between space-y-6">
                <div className="space-y-4 glass-card p-6 rounded-3xl h-full flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-3 w-3 rounded-full insta-gradient animate-pulse" />
                    <span className="text-[#f09433] font-bold tracking-widest text-sm uppercase">@{data.owner_name}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black text-white/90 leading-tight">
                    &quot;{data.caption.length > 150 ? data.caption.substring(0, 150) + '...' : data.caption}&quot;
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <Card className="glass-card glass-card-hover group border-[#f09433]/20 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#dc2743]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <CardHeader className="pb-2 pt-6">
                      <CardTitle className="text-sm font-bold tracking-widest uppercase flex items-center gap-2 text-white/50">
                        <Heart className="h-5 w-5 text-[#dc2743] drop-shadow-[0_0_8px_rgba(220,39,67,0.8)]" /> Curtidas (Post)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-5xl font-black text-white">{data.likes_count.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="glass-card glass-card-hover group border-[#833AB4]/20 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#bc1888]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <CardHeader className="pb-2 pt-6">
                      <CardTitle className="text-sm font-bold tracking-widest uppercase flex items-center gap-2 text-white/50">
                        <MessageCircle className="h-5 w-5 text-[#bc1888] drop-shadow-[0_0_8px_rgba(188,24,136,0.8)]" /> Comentários (Carregados)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-5xl font-black text-white">{data.comments_count.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Filtros em Neon e Sub-matrizes */}
            <div className="grid md:grid-cols-12 gap-6 items-stretch pt-6">
              <div className="col-span-6 relative">
                 <div className="h-full glass-card p-2 rounded-2xl flex items-center relative pr-4">
                   <div className="bg-[#f09433]/20 p-4 rounded-xl mr-4 flex items-center justify-center">
                      <Filter className="h-6 w-6 text-[#f09433]" />
                   </div>
                   <Input
                      placeholder="Filtre discussões por palavras-chave em tempo real..."
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="h-14 font-medium text-lg bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-white/30 pl-2 focus-visible:ring-offset-0"
                   />
                 </div>
              </div>

              <Card className="col-span-3 glass-card glass-card-hover border-[#dc2743]/20 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#dc2743]/10 rounded-full blur-2xl translate-x-10 translate-y-[-10px]" />
                <CardContent className="p-6">
                  <span className="text-xs font-bold tracking-widest uppercase text-[#dc2743]/60 mb-1 block">Ocorrências Exatas</span>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-[#dc2743] drop-shadow-[0_0_10px_rgba(220,39,67,0.5)]">{occurrencesCount}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-3 glass-card glass-card-hover border-[#bc1888]/20 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#bc1888]/10 rounded-full blur-2xl translate-x-[-20px] translate-y-[20px]" />
                <CardContent className="p-6">
                  <span className="text-xs font-bold tracking-widest uppercase text-[#bc1888]/60 mb-1 block">Comentários (Keyword)</span>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-[#bc1888] drop-shadow-[0_0_10px_rgba(188,24,136,0.5)]">{filteredComments.length}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Comentários */}
            <Card className="glass-card border-white/10 overflow-hidden shadow-2xl rounded-3xl mt-8">
              <div className="flex flex-col md:flex-row justify-between items-center p-6 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                   <div className="p-3 bg-white/5 rounded-xl border border-white/10 shadow-[0_0_15px_rgba(237,73,86,0.2)]">
                      <FileText className="h-6 w-6 text-[#dc2743]" />
                   </div>
                   <div>
                      <h3 className="text-xl font-bold text-white tracking-tight">Tabela de Análise</h3>
                      <p className="text-sm text-white/40">Selecione as colunas para o arquivo local.</p>
                   </div>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                  <Button 
                     variant="outline" 
                     className="flex-1 md:flex-none h-12 rounded-xl bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 hover:text-white transition-all ring-offset-background group" 
                     onClick={handleExportSelected} 
                     disabled={Object.keys(rowSelection).length === 0}
                  >
                    <Download className="mr-2 h-4 w-4 text-[#bc1888] group-hover:scale-110 transition-transform" /> Apenas Selecionados
                  </Button>
                  <Button 
                     className="flex-1 md:flex-none h-12 rounded-xl insta-gradient text-white border border-white/20 shadow-lg transition-all insta-gradient-hover group" 
                     onClick={handleExportAll} 
                     disabled={filteredComments.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" /> Extrair Tudo
                  </Button>
                </div>
              </div>

              {/* The Responsive Dataset */}
              <div className="overflow-x-auto">
                <Table className="w-full">
                  <TableHeader className="bg-white/[0.02]">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="border-white/5 hover:bg-transparent">
                        {headerGroup.headers.map((header) => {
                          return (
                            <TableHead key={header.id} className="text-[#f09433] font-bold uppercase tracking-widest text-xs h-16">
                              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow 
                           key={row.id} 
                           data-state={row.getIsSelected() && "selected"} 
                           className="border-white/5 hover:bg-white/[0.03] transition-colors group data-[state=selected]:bg-[#dc2743]/10 data-[state=selected]:border-[#dc2743]/20 cursor-pointer"
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="py-5 px-4 font-medium align-middle">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center space-y-3">
                             <Camera className="h-10 w-10 text-white/20 mb-2" />
                             <p className="text-white/50 text-lg font-medium">Nenhum comentário visível aqui.</p>
                             <p className="text-white/30 text-sm">Filtre diferente ou forneça a URL no painel acima.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Advanced Pagination UI */}
              <div className="p-6 flex flex-col md:flex-row items-center justify-between border-t border-white/5 bg-black/20 gap-4">
                <div className="text-sm font-medium text-white/40">
                  <span className="text-[#dc2743] font-bold">{table.getFilteredSelectedRowModel().rows.length}</span> de <span className="font-bold text-white/80">{table.getFilteredRowModel().rows.length}</span> linha(s) marcadas.
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    className="h-10 px-4 rounded-xl bg-white/5 border-white/10 text-white hover:bg-[#dc2743]/20 hover:text-[#dc2743] hover:border-[#dc2743]/50 transition-all font-bold"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Retroceder
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 px-4 rounded-xl bg-white/5 border-white/10 text-white hover:bg-[#833AB4]/20 hover:text-[#833AB4] hover:border-[#833AB4]/50 transition-all font-bold"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
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
