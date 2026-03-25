import { NextResponse } from 'next/server';

export const maxDuration = 60;

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}/get_post_comments.php`;

/** Extract shortcode from a full Instagram URL, or return the input as-is */
function extractShortcode(input: string): string {
  const match = input.match(/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_\-]+)/);
  if (match) return match[1];
  return input.trim();
}

/** Convert Instagram shortcode to numeric media/post ID */
function shortcodeToMediaId(shortcode: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = BigInt(0);
  for (let i = 0; i < shortcode.length; i++) {
    id = (id * BigInt(64)) + BigInt(alphabet.indexOf(shortcode[i]));
  }
  return id.toString();
}

function convertUnixToDate(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(comment: any, index: number) {
  const username = comment.user?.username || `user_${index}`;
  return {
    id: comment.pk || comment.id || `cid_${index}`,
    // comment_id used for fetching child comments (same as id/pk)
    comment_id: String(comment.pk || comment.id || `cid_${index}`),
    avatar: comment.user?.profile_pic_url || `https://i.pravatar.cc/40?u=${username}`,
    username,
    text: comment.text || '',
    date: comment.created_at
      ? convertUnixToDate(comment.created_at)
      : new Date().toLocaleDateString('pt-BR'),
    likesCount: comment.comment_like_count || 0,
    repliesCount: comment.child_comment_count || 0,
    childComments: [],
    profile_link: `https://instagram.com/${username}`,
  };
}

export async function POST(request: Request) {
  try {
    const { shortcode, pagination_token } = await request.json();

    if (!shortcode) {
      return NextResponse.json({ error: 'shortcode obrigatório' }, { status: 400 });
    }

    if (!RAPIDAPI_KEY) {
      return NextResponse.json({ error: 'RAPIDAPI_KEY não configurada no servidor' }, { status: 500 });
    }

    const mediaCode = extractShortcode(shortcode);

    // Build query string — real endpoint is GET /get_post_comments.php
    const params = new URLSearchParams({
      media_code: mediaCode,
      sort_order: 'popular',
    });
    if (pagination_token) {
      params.set('pagination_token', pagination_token);
    }

    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Falha na API: ${res.status} ${err}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Response shape: { data: { items: [...], pagination_token: "...", media_id: "..." } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawComments: any[] =
      data?.data?.items ??
      data?.items ??
      data?.comments ??
      [];

    const nextToken: string | null =
      data?.data?.pagination_token ??
      data?.pagination_token ??
      null;

    // The API doesn't guarantee a media_id in the response for this endpoint,
    // so we MUST compute the numeric post_id directly from the shortcode.
    // This post_id is required to fetch replies later.
    const post_id: string = shortcodeToMediaId(mediaCode);

    const comments = rawComments.map(mapComment);

    return NextResponse.json({
      comments,
      pagination_token: nextToken,
      post_id,
      count: comments.length,
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Analyze Error:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar comentários' }, { status: 500 });
  }
}
