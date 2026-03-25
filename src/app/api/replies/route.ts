import { NextResponse } from 'next/server';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';

function convertUnixToDate(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReply(r: any, index: number) {
  const username = r.user?.username || `user_${index}`;
  return {
    id: r.pk || r.id || `r_${index}`,
    text: r.text || '',
    ownerUsername: username,
    ownerProfilePicUrl: r.user?.profile_pic_url || `https://i.pravatar.cc/40?u=${username}`,
    timestamp: r.created_at
      ? convertUnixToDate(r.created_at)
      : new Date().toLocaleDateString('pt-BR'),
    likesCount: r.comment_like_count || 0,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const post_id = searchParams.get('post_id');
  const comment_id = searchParams.get('comment_id');

  if (!post_id || !comment_id) {
    return NextResponse.json({ error: 'post_id e comment_id são obrigatórios' }, { status: 400 });
  }

  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY não configurada' }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({ post_id, comment_id });

    const res = await fetch(
      `https://${RAPIDAPI_HOST}/get_post_child_comments.php?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Falha na API de replies: ${res.status} ${err}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawReplies: any[] =
      data?.data?.child_comments ??
      data?.child_comments ??
      data?.data?.items ??
      data?.items ??
      [];

    return NextResponse.json({
      replies: rawReplies.map(mapReply),
      count: rawReplies.length,
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Replies Error:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar respostas' }, { status: 500 });
  }
}
