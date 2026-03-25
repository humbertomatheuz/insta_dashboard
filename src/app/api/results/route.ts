import { NextResponse } from 'next/server';

const TOKEN = process.env.APIFY_TOKEN;
const PAGE_SIZE = 10;

// Mapeamento correto baseado na estrutura real retornada pela Task do Apify
// Campos reais: postUrl, commentUrl, id, text, ownerUsername, ownerProfilePicUrl,
//               timestamp, repliesCount, replies[], likesCount, owner{}, metaData{}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReply(r: any, index: number) {
  return {
    id: r.id || `r_${index}`,
    text: r.text || '',
    ownerUsername: r.ownerUsername || r.owner?.username || `user_${index}`,
    ownerProfilePicUrl: r.ownerProfilePicUrl || r.owner?.profile_pic_url || `https://i.pravatar.cc/40?u=${index}`,
    timestamp: r.timestamp || new Date().toISOString(),
    likesCount: r.likesCount || 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(item: any, index: number) {
  const username = item.ownerUsername || item.owner?.username || `user_${index}`;
  const avatar = item.ownerProfilePicUrl || item.owner?.profile_pic_url || `https://i.pravatar.cc/40?u=${username}`;
  const rawReplies = Array.isArray(item.replies) ? item.replies : [];

  return {
    id: item.id || `cid_${index}`,
    avatar,
    username,
    text: item.text || '',
    date: item.timestamp || new Date().toISOString(),
    likesCount: item.likesCount || 0,
    repliesCount: item.repliesCount || rawReplies.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    childComments: rawReplies.map((r: any, i: number) => mapReply(r, i)),
    profile_link: `https://instagram.com/${username}`,
    postUrl: item.postUrl || '',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datasetId = searchParams.get('datasetId');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const keyword = (searchParams.get('keyword') || '').toLowerCase().trim();
  const metaOnly = searchParams.get('meta') === '1';

  if (!datasetId) {
    return NextResponse.json({ error: 'datasetId obrigatório' }, { status: 400 });
  }

  try {
    // Buscar info total do dataset
    const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}?token=${TOKEN}`);
    const dsData = await dsRes.json();
    const totalItems: number = dsData.data?.itemCount || 0;

    if (metaOnly) {
      // A Task não retorna metadados do post junto com os comentários.
      // Precisamos fazer uma chamada separada para obter os dados do post via postUrl.
      // Por ora, retornamos somente os dados disponíveis do dataset.
      const firstRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${TOKEN}&limit=1`
      );
      const firstItems = await firstRes.json();
      const first = Array.isArray(firstItems) && firstItems.length > 0 ? firstItems[0] : null;
      
      return NextResponse.json({
        totalItems,
        postUrl: first?.postUrl || null,
        // Metadados reais do post virão de uma chamada separada via postUrl se disponível
        owner_name: null,
        likes_count: null,
        comments_count: totalItems,
        thumbnail_url: null,
        video_url: null,
        caption: null,
      });
    }

    if (keyword) {
      // BUSCA NO TOTAL: carrega TODOS os itens do dataset e filtra server-side
      // (necessário para busca completa, não apenas na página atual)
      const allRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${TOKEN}&limit=10000`
      );
      const allItems = await allRes.json();

      if (!Array.isArray(allItems)) {
        return NextResponse.json({ error: 'Erro ao buscar dataset' }, { status: 500 });
      }

      const mapped = allItems.map(mapComment);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtered = mapped.filter((c: any) =>
        c.text.toLowerCase().includes(keyword) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        c.childComments.some((r: any) => r.text.toLowerCase().includes(keyword))
      );

      // Conta ocorrências totais
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'gi');
      let occurrences = 0;
      for (const c of mapped) {
        occurrences += (c.text.match(re) || []).length;
        for (const r of c.childComments) {
          occurrences += (r.text.match(re) || []).length;
        }
      }

      const offset = (page - 1) * PAGE_SIZE;
      return NextResponse.json({
        comments: filtered.slice(offset, offset + PAGE_SIZE),
        total: filtered.length,
        totalAll: mapped.length,
        occurrences,
        page,
        pageSize: PAGE_SIZE,
        hasMore: offset + PAGE_SIZE < filtered.length,
      });
    }

    // Paginação normal: busca só a página atual diretamente no dataset Apify
    const offset = (page - 1) * PAGE_SIZE;
    const pageRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${TOKEN}&limit=${PAGE_SIZE}&offset=${offset}`
    );
    const pageItems = await pageRes.json();

    if (!Array.isArray(pageItems)) {
      return NextResponse.json({ error: 'Erro ao buscar página do dataset' }, { status: 500 });
    }

    return NextResponse.json({
      comments: pageItems.map(mapComment),
      total: totalItems,
      totalAll: totalItems,
      occurrences: 0,
      page,
      pageSize: PAGE_SIZE,
      hasMore: offset + PAGE_SIZE < totalItems,
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Results Error:', error);
    return NextResponse.json({ error: 'Erro ao buscar resultados' }, { status: 500 });
  }
}
