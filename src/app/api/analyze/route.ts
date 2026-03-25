import { NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN;
// Usando o Actor de Comentários do Apify diretamente
const APIFY_ACTOR_URL = `https://api.apify.com/v2/acts/apify~instagram-comment-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

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
    : '#'
});

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('instagram.com')) {
      return NextResponse.json({ error: 'URL do Instagram inválida' }, { status: 400 });
    }

    const apifyResponse = await fetch(APIFY_ACTOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [url],
        resultsType: 'comments',
        resultsLimit: 1000,
        includeChildComments: true,
        viewParentPost: true,
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

    // Com viewParentPost: true, os metadados do post vêm em parentData ou diretamente no item
    const parentData = firstItem?.parentData || firstItem?.postData || firstItem?.inputData || {};

    const viewData = {
      owner_name: parentData.ownerUsername || parentData.username || firstItem?.ownerUsername || 'Desconhecido',
      likes_count: parentData.likesCount || parentData.likeCount || 0,
      comments_count: parentData.commentsCount || parentData.commentCount || data.length,
      video_url: parentData.videoUrl || null,
      thumbnail_url: parentData.displayUrl || parentData.imageUrl || parentData.thumbnail || null,
      caption: parentData.caption || parentData.text || '',
      comments: data.map(mapComment),
    };

    return NextResponse.json(viewData);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar URL' }, { status: 500 });
  }
}
