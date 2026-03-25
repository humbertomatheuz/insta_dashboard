import { NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
// Usando a Task configurada do usuário
const APIFY_TASK_URL = `https://api.apify.com/v2/actor-tasks/humbertomatheuz~instagram-scraper-task/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapChildComment = (c: any, index: number) => ({
  id: c.id || `child_${index}`,
  text: c.text || '',
  ownerUsername: c.ownerUsername || c.username || `user_${index}`,
  ownerProfilePicUrl: c.ownerProfilePicUrl || c.profilePicUrl || 'https://i.pravatar.cc/150',
  timestamp: c.timestamp || new Date().toISOString(),
  likesCount: c.likesCount || 0,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapComment = (c: any, index: number) => ({
  id: c.id || `cid_${index}`,
  avatar: c.ownerProfilePicUrl || c.profilePicUrl || 'https://i.pravatar.cc/150',
  username: c.ownerUsername || c.username || `user_${index}`,
  text: c.text || '',
  date: c.timestamp || new Date().toISOString(),
  likesCount: c.likesCount || 0,
  childComments: Array.isArray(c.childComments)
    ? c.childComments.map(mapChildComment)
    : [],
  profile_link: (c.ownerUsername || c.username)
    ? `https://instagram.com/${c.ownerUsername || c.username}`
    : '#',
});

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('instagram.com')) {
      return NextResponse.json({ error: 'URL do Instagram inválida' }, { status: 400 });
    }

    // Envia somente a URL — os parâmetros fixos (resultsType, resultsLimit etc.)
    // já estão configurados como padrão na Task do Apify.
    const apifyResponse = await fetch(APIFY_TASK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [url],
      }),
    });

    if (!apifyResponse.ok) {
      const errorText = await apifyResponse.text();
      try {
        const errorJson = JSON.parse(errorText);
        const msg = typeof errorJson.error === 'string'
          ? errorJson.error
          : (errorJson.error?.message || 'Falha na validação do Apify');
        return NextResponse.json({ error: msg }, { status: apifyResponse.status });
      } catch {
        return NextResponse.json({ error: 'Falha ao se comunicar com Apify' }, { status: apifyResponse.status });
      }
    }

    const data = await apifyResponse.json();

    if (data && !Array.isArray(data) && data.error) {
      const msg = typeof data.error === 'string' ? data.error : (data.error?.message || 'Erro na API do Apify');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'A extração retornou vazia. Verifique se o post é público.' }, { status: 404 });
    }

    const firstItem = data[0];

    if (firstItem?.error) {
      return NextResponse.json({ error: firstItem.errorDescription || firstItem.error }, { status: 403 });
    }

    // Com addParentData: true na Task, os dados do post pai ficam em cada item
    const parentData =
      firstItem?.parentPost ||
      firstItem?.postData ||
      firstItem?.parentData ||
      {};

    // Metadados do post (likes/comments totais)
    const owner_name =
      parentData.ownerUsername ||
      parentData.username ||
      firstItem?.postOwnerUsername ||
      'Desconhecido';

    const likes_count =
      parentData.likesCount ||
      parentData.likeCount ||
      firstItem?.postLikesCount ||
      0;

    // Total real de comentários do post (da API), não apenas os extraídos
    const comments_count =
      parentData.commentsCount ||
      parentData.commentCount ||
      firstItem?.postCommentsCount ||
      data.length;

    const thumbnail_url =
      parentData.displayUrl ||
      parentData.imageUrl ||
      parentData.thumbnail ||
      firstItem?.postUrl ||
      null;

    const video_url =
      parentData.videoUrl ||
      firstItem?.postVideoUrl ||
      null;

    const caption =
      parentData.caption ||
      parentData.text ||
      firstItem?.postCaption ||
      '';

    const viewData = {
      owner_name,
      likes_count,
      comments_count,
      video_url,
      thumbnail_url,
      caption,
      // Todos os comentários extraídos (paginados no frontend)
      comments: data.map(mapComment),
    };

    return NextResponse.json(viewData);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar URL' }, { status: 500 });
  }
}
