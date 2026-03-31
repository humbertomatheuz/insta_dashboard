import { NextResponse } from 'next/server';
import https from 'https';
import zlib from 'zlib';

export const maxDuration = 60;

/** Extract shortcode from a full Instagram URL, or return the input as-is */
function extractShortcode(input: string): string {
  const match = input.match(/instagram\.com\/(?:p|reel|tv|reels)\/([A-Za-z0-9_\-]+)/);
  if (match) return match[1];
  return input.trim();
}

function convertUnixToDate(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReply(r: any, i: number) {
  const node = r.node || r;
  const username = node.owner?.username || `user_${i}`;
  return {
    id: String(node.id || `r_${i}`),
    text: node.text || '',
    ownerUsername: username,
    ownerProfilePicUrl: node.owner?.profile_pic_url || `https://i.pravatar.cc/40?u=${username}`,
    timestamp: node.created_at ? convertUnixToDate(node.created_at) : new Date().toLocaleDateString('pt-BR'),
    likesCount: node.edge_liked_by?.count || 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(comment: any, index: number) {
  const node = comment.node || comment;
  const username = node.owner?.username || `user_${index}`;
  const text = node.text || '';
  const createdAt = node.created_at;
  const fallbackId = `cid_${username}_${createdAt ?? index}`;
  const pk = node.id ?? node.comment_id ?? node.commentId ?? fallbackId;
  const likesCount = node.edge_liked_by?.count || 0;
  const childCount = node.edge_threaded_comments?.count || 0;
  const profilePic = node.owner?.profile_pic_url || `https://i.pravatar.cc/40?u=${username}`;

  return {
    id: String(pk),
    comment_id: String(pk),
    avatar: profilePic,
    username,
    text,
    date: createdAt ? convertUnixToDate(createdAt) : new Date().toLocaleDateString('pt-BR'),
    likesCount,
    repliesCount: childCount,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    childComments: (node.edge_threaded_comments?.edges || []).map((r: any, i: number) => mapReply(r, i)),
    profile_link: `https://instagram.com/${username}`,
  };
}

type CommentPageInfo = {
  has_next_page?: boolean;
  end_cursor?: string | null;
};

type CommentEdge = {
  edges?: unknown[];
  page_info?: CommentPageInfo;
  count?: number;
};

type InstagramGraphQLResponse = {
  status?: string;
  errors?: unknown;
  message?: string;
  data?: {
    xdt_shortcode_media?: { edge_media_to_parent_comment?: CommentEdge | null } | null;
    shortcode_media?: { edge_media_to_parent_comment?: CommentEdge | null } | null;
  };
};

// Helper: POST request (Instagram GraphQL requires POST for cursor pagination)
function makeHttpsPostRequest(
  url: string,
  body: string,
  headers: Record<string, string>,
  redirectCount = 0
): Promise<InstagramGraphQLResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    headers['Accept-Encoding'] = 'gzip, deflate, br';
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = String(Buffer.byteLength(body));

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers,
    };

    const req = https.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (res.headers.location.includes('/login/')) {
          return reject(new Error('Sessão expirada ou bloqueada. Faça login novamente no Instagram.'));
        }
        if (redirectCount >= 3) {
          return reject(new Error('Muitos redirecionamentos seguidos pelo Instagram (Loop). Verifique seu SessionID.'));
        }
        const newCookies = res.headers['set-cookie'] || [];
        let cookieString = headers['Cookie'] || '';
        newCookies.forEach(c => {
          const cookiePart = c.split(';')[0];
          if (cookieString && !cookieString.endsWith('; ')) cookieString += '; ';
          cookieString += cookiePart;
        });
        headers['Cookie'] = cookieString;
        let newLocation = res.headers.location;
        if (newLocation.startsWith('/')) newLocation = 'https://www.instagram.com' + newLocation;
        return resolve(makeHttpsPostRequest(newLocation, body, headers, redirectCount + 1));
      }

      if (res.statusCode && res.statusCode >= 400) {
        if (res.statusCode === 429) return reject(new Error('RATE_LIMIT'));
        return reject(new Error(`Instagram API falhou com status ${res.statusCode}`));
      }

      let responseStream: import('stream').Readable = res;
      const encoding = res.headers['content-encoding'];
      if (encoding === 'br') responseStream = res.pipe(zlib.createBrotliDecompress());
      else if (encoding === 'gzip') responseStream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') responseStream = res.pipe(zlib.createInflate());

      let data = '';
      responseStream.on('data', chunk => data += chunk);
      responseStream.on('end', () => {
        try {
          resolve(JSON.parse(data) as InstagramGraphQLResponse);
        } catch {
          if (data.includes('<html') || data.includes('<body')) {
            reject(new Error('Instagram bloqueou a requisição (Página HTML retornada, possível limitação)'));
          } else {
            reject(new Error(`Falha ao analisar JSON do Instagram. Início: ${data.slice(0, 50)}...`));
          }
        }
      });
      responseStream.on('error', (err) => reject(new Error(`Erro no fluxo de descompressão: ${err.message}`)));
    });
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

async function fetchViaGraphQL(
  shortcode: string,
  paginationToken: unknown,
  sessionId: string,
  userAgent: string
) {
  function normalizeAfterCursor(token: unknown, depth: number = 0): string | null {
    if (depth > 2) return null;
    if (token === null || token === undefined) return null;

    // Frontend may send `pagination_token` as a JSON-stringified object:
    //   "{\"cached_comments_cursor\":\"17993001104937204\"}"
    // or directly as an object: { cached_comments_cursor: "179..." }
    if (typeof token === 'string') {
      const trimmed = token.trim();
      if (!trimmed) return null;
      // Important: cursor puro pode ser uma string numérica ("1799..."), e isso também é JSON válido
      // (um número). Só fazemos JSON.parse quando parece objeto JSON de verdade.
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          const cached = parsed?.cached_comments_cursor;
          if (typeof cached === 'string' && cached.trim()) return cached.trim();
          return null;
        } catch {
          return null;
        }
      }

      // Caso a API envie um JSON-string (ex: "\"1799...\"")
      if (trimmed.startsWith('"')) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (typeof parsed === 'string') {
            return normalizeAfterCursor(parsed, depth + 1);
          }
          if (typeof parsed === 'number' && Number.isFinite(parsed)) {
            return String(parsed);
          }
          if (typeof parsed === 'object' && parsed) {
            const rec = parsed as Record<string, unknown>;
            const cached = rec.cached_comments_cursor;
            if (typeof cached === 'string' && cached.trim()) return cached.trim();
          }
        } catch {
          // fallthrough
        }
      }

      // Cursor alfanumérico (ex: "17993001104937204")
      return trimmed;
    }

    if (typeof token === 'object') {
      const rec = token as Record<string, unknown>;
      const cached = rec.cached_comments_cursor;
      if (typeof cached === 'string' && cached.trim()) return cached;
    }

    return null;
  }

  function extractBifilterToken(token: unknown, depth: number = 0): string | null {
    if (depth > 2) return null;
    if (token === null || token === undefined) return null;

    if (typeof token === 'string') {
      const trimmed = token.trim();
      if (!trimmed) return null;

      // Desencapsula JSON-string (ex: "\"{...}\"")
      if (trimmed.startsWith('"')) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          return extractBifilterToken(parsed, depth + 1);
        } catch {
          return null;
        }
      }

      // JSON object encoded as string
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          const bifilter = parsed?.bifilter_token;
          if (typeof bifilter === 'string' && bifilter.trim()) return bifilter.trim();
        } catch {
          // ignore
        }
      }

      return null;
    }

    if (typeof token === 'object') {
      const rec = token as Record<string, unknown>;
      const bifilter = rec?.bifilter_token;
      if (typeof bifilter === 'string' && bifilter.trim()) return bifilter.trim();
    }

    return null;
  }

  const afterCursor = normalizeAfterCursor(paginationToken);
  const bifilterTokenFromRequest = extractBifilterToken(paginationToken);

  const csrftoken = 'dummy_csrf_token_12345';

  const headers: Record<string, string> = {
    'Cookie': `sessionid=${sessionId}; csrftoken=${csrftoken}`,
    'X-Csrftoken': csrftoken,
    'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'X-IG-App-ID': '936619743392459',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': '*/*',
    'Origin': 'https://www.instagram.com',
    'Referer': `https://www.instagram.com/p/${shortcode}/`,
  };

  // Use POST — Instagram ignores the `after` cursor on GET requests.
  // The web app always uses POST with form-encoded body for GraphQL pagination.
  async function runQuery(afterPayload: string | { cached_comments_cursor: string } | null) {
    const variablesObj: Record<string, unknown> = {
      shortcode,
      first: 50,
    };

    if (afterPayload) variablesObj.after = afterPayload;
    if (bifilterTokenFromRequest) variablesObj.bifilter_token = bifilterTokenFromRequest;

    const variables = JSON.stringify(variablesObj);

    const formBody = new URLSearchParams({
      doc_id: '8845758582119845',
      variables,
    }).toString();

    const data = await makeHttpsPostRequest('https://www.instagram.com/graphql/query/', formBody, headers);

    if (data.status === 'fail' || data.errors) {
      throw new Error(data.message || 'Falha na requisição GraphQL do Instagram. Verifique seu login.');
    }

    const parentCommentEdge = data?.data?.xdt_shortcode_media?.edge_media_to_parent_comment || data?.data?.shortcode_media?.edge_media_to_parent_comment;
    if (!parentCommentEdge) {
      return { comments: [], nextCursor: null as string | null, totalCount: 0, hasNextPage: false, nextCursorRaw: null as unknown };
    }

    const edges = parentCommentEdge.edges || [];
    const pageInfo = parentCommentEdge.page_info || {};
    const totalCount = parentCommentEdge.count || edges.length;
    const hasNextPage = !!pageInfo.has_next_page;
    const nextCursorRaw = hasNextPage ? pageInfo.end_cursor : null;

    // Preserve o `end_cursor` exatamente como o Instagram retorna.
    // Isso pode conter `cached_comments_cursor` + `bifilter_token` embutidos.
    // O backend vai extrair somente `cached_comments_cursor` para preencher o campo GraphQL `after`
    // na próxima requisição (nunca envia o objeto JSON completo no `after`).
    const nextTokenForFrontend = (() => {
      if (!hasNextPage || !nextCursorRaw) return null;
      if (typeof nextCursorRaw === 'string') return nextCursorRaw;
      if (typeof nextCursorRaw === 'number' && Number.isFinite(nextCursorRaw)) return String(nextCursorRaw);
      try {
        return JSON.stringify(nextCursorRaw);
      } catch {
        return null;
      }
    })();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comments = edges.map((edge: any, i: number) => mapComment(edge, i));

    return { comments, nextCursor: nextTokenForFrontend, totalCount, hasNextPage, nextCursorRaw };
  }

  // 1) Tentativa principal: cursor puro como string
  let result = await runQuery(afterCursor ? afterCursor : null);

  // (Sem recursão/loop extra aqui no backend.)

  return { comments: result.comments, nextCursor: result.nextCursor, totalCount: result.totalCount, hasNextPage: result.hasNextPage };
}

export async function POST(request: Request) {
  try {
    const { shortcode, pagination_token, sessionId, userAgent } = await request.json();

    if (!shortcode) {
      return NextResponse.json({ error: 'shortcode obrigatório' }, { status: 400 });
    }
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Sessão é obrigatória para usar o GraphQL do Instagram' }, { status: 401 });
    }

    const mediaCode = extractShortcode(shortcode);

    const result = await fetchViaGraphQL(mediaCode, pagination_token || null, sessionId, userAgent);

    return NextResponse.json({
      comments: result.comments,
      pagination_token: result.nextCursor,
      page_info: {
        has_next_page: result.hasNextPage,
        end_cursor: result.nextCursor,
      },
      post_id: mediaCode, // Using shortcode here for dashboard reference
      count: result.totalCount,
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Analyze Error:', error);
    if (error.message === 'RATE_LIMIT') {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
    }
    return NextResponse.json({ error: error.message || 'Erro interno ao buscar comentários' }, { status: 500 });
  }
}
