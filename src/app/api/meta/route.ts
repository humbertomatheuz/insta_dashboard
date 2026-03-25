import { NextResponse } from 'next/server';

export const maxDuration = 60; // Duração maior para sync call

const TOKEN = process.env.APIFY_TOKEN;
const TASK_ID = 'humbertomatheuz~instagram-scraper-task';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'url obrigatório' }, { status: 400 });
  }

  try {
    // Usamos a Task do usuário, forçando resultadosType: details para pegar apenas dados do post
    const res = await fetch(
      `https://api.apify.com/v2/actor-tasks/${TASK_ID}/run-sync-get-dataset-items?token=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          directUrls: [url],
          resultsType: 'details',
          resultsLimit: 1
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Falha ao buscar metadados do post' }, { status: res.status });
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: 'Post não encontrado ou privado' }, { status: 404 });
    }

    const first = data[0];
    const post = first.postData || first.parentData || first || {};

    return NextResponse.json({
      owner_name: post.ownerUsername || post.username || null,
      likes_count: post.likesCount || post.likeCount || 0,
      comments_count: post.commentsCount || post.commentCount || 0,
      thumbnail_url: post.displayUrl || post.thumbnail || post.imageUrl || null,
      video_url: post.videoUrl || null,
      caption: post.caption || post.text || '',
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Meta API Error:', error);
    return NextResponse.json({ error: 'Erro ao buscar metadados' }, { status: 500 });
  }
}
