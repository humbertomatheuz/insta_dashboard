import { NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_TASK_URL = `https://api.apify.com/v2/actor-tasks/humbertomatheuz~instagram-scraper-task/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('instagram.com')) {
      return NextResponse.json({ error: 'URL do Instagram inválida' }, { status: 400 });
    }

    const apifyResponse = await fetch(APIFY_TASK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addParentData: false,
        directUrls: [url],
        resultsLimit: 200,
        resultsType: 'posts',
        searchLimit: 1,
        searchType: 'hashtag'
      }),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      try {
        const errorJson = JSON.parse(errorText);
        const msg = typeof errorJson.error === 'string' ? errorJson.error : (errorJson.error?.message || 'Falha na validação do Apify');
        return NextResponse.json({ error: msg }, { status: apifyResponse.status });
      } catch {
        return NextResponse.json({ error: 'Falha ao se comunicar com Apify' }, { status: apifyResponse.status });
      }
    }

    const data = await apifyResponse.json();

    if (data && data.error) {
      const msg = typeof data.error === 'string' ? data.error : (data.error.message || 'Erro na API do Apify');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'A extração retornou vazia.' }, { status: 404 });
    }
    
    // O Apify pode retornar duas estruturas dependendo da configuração da Task:
    // 1. Array com 1 objeto de Post (resultsType: 'details') contendo latestComments
    // 2. Array de objetos de Comentários (resultsType: 'comments') contendo apenas comentários

    const viewData = {
      owner_name: 'Desconhecido',
      likes_count: 0,
      comments_count: 0,
      video_url: null,
      thumbnail_url: 'https://via.placeholder.com/400',
      caption: 'Informações do post indisponíveis (Modo "Comments" ativo)',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comments: [] as any[]
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapComment = (c: any, index: number) => ({
      id: c.id || `cid_${index}`,
      avatar: c.ownerProfilePicUrl || c.profilePicUrl || 'https://i.pravatar.cc/150',
      username: c.ownerUsername || c.username || `user_${index}`,
      text: c.text || '',
      date: c.timestamp || new Date().toISOString(),
      likes: c.likesCount || c.likeCount || 0,
      replies: c.answersCount || c.repliesCount || 0,
      profile_link: (c.ownerUsername || c.username) 
        ? `https://instagram.com/${c.ownerUsername || c.username}` 
        : '#'
    });

    const firstItem = data[0];

    // Trata erro retornado dentro do item
    if (firstItem.error) {
      return NextResponse.json({ error: firstItem.errorDescription || firstItem.error }, { status: 403 });
    }

    // Caso 1: Retornou os Detalhes do Post
    if (firstItem.caption !== undefined || firstItem.latestComments !== undefined) {
      viewData.owner_name = firstItem.ownerUsername || firstItem.ownerFullName || firstItem.username || 'Desconhecido';
      viewData.likes_count = firstItem.likesCount || firstItem.likeCount || 0;
      viewData.comments_count = firstItem.commentsCount || firstItem.commentCount || 0;
      viewData.video_url = firstItem.videoUrl || null;
      viewData.thumbnail_url = firstItem.displayUrl || firstItem.imageUrl || firstItem.thumbnail || 'https://via.placeholder.com/400';
      viewData.caption = firstItem.caption || firstItem.text || 'Sem legenda';
      
      const rawComments = firstItem.comments || firstItem.latestComments || [];
      viewData.comments = rawComments.map(mapComment);
    } 
    // Caso 2: Retornou diretamente uma lista de Comentários
    else if (firstItem.text !== undefined && firstItem.ownerUsername !== undefined) {
      viewData.comments_count = data.length;
      viewData.comments = data.map(mapComment);
    }

    return NextResponse.json(viewData);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar URL' }, { status: 500 });
  }
}
