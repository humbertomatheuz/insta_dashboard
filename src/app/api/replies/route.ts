import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import https from 'https';
import zlib from 'zlib';

function convertUnixToDate(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReply(r: any, index: number) {
  const node = r.node || r;
  const username = node.owner?.username || `user_${index}`;
  return {
    id: String(node.id || `r_${index}`),
    text: node.text || '',
    ownerUsername: username,
    ownerProfilePicUrl: node.owner?.profile_pic_url || `https://i.pravatar.cc/40?u=${username}`,
    timestamp: node.created_at ? convertUnixToDate(node.created_at) : new Date().toLocaleDateString('pt-BR'),
    likesCount: node.edge_liked_by?.count || 0,
  };
}

// Helper: POST request (Instagram GraphQL requires POST for cursor pagination)
function makeHttpsPostRequest(url: string, body: string, headers: Record<string, string>, redirectCount = 0): Promise<any> {
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
        return reject(new Error(`GraphQL replies falhou: ${res.statusCode}`));
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
          resolve(JSON.parse(data));
        } catch {
          if (data.includes('<html') || data.includes('<body')) {
            reject(new Error('Instagram bloqueou a requisição (Página HTML retornada, possível limitação)'));
          } else {
            reject(new Error(`Falha ao analisar JSON do Instagram (Replies). Início: ${data.slice(0, 50)}...`));
          }
        }
      });
      responseStream.on('error', (err) => reject(new Error(`Erro no fluxo: ${err.message}`)));
    });
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const comment_id = searchParams.get('comment_id');
  const shortcode = searchParams.get('post_id'); // post_id is actually the shortcode here
  const sessionId = searchParams.get('sessionId');
  const userAgent = searchParams.get('userAgent');
  const after = searchParams.get('after') || null; // cursor for reply pagination

  if (!comment_id || !shortcode) {
    return NextResponse.json({ error: 'comment_id e post_id são obrigatórios' }, { status: 400 });
  }
  
  if (!sessionId) {
    return NextResponse.json({ error: 'Sessão é obrigatória para usar o GraphQL' }, { status: 401 });
  }

  try {
    // We use the same post comments doc_id but with the comment cursor embedded
    // Instagram encodes reply pagination inside the comment's edge_threaded_comments
    const variables: Record<string, unknown> = {
      shortcode,
      first: 50,
    };
    
    // When fetching replies, we paginate using the comment's threaded cursor
    if (after) {
      variables.after = after;
    }

    const params = new URLSearchParams({
      doc_id: '8845758582119845',
      variables: JSON.stringify(variables),
    });

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

    const formBody = new URLSearchParams({
      doc_id: '8845758582119845',
      variables: JSON.stringify(variables),
    }).toString();

    const data = await makeHttpsPostRequest('https://www.instagram.com/graphql/query/', formBody, headers);

    if (data.status === 'fail' || data.errors) {
      throw new Error(data.message || 'Falha na requisição GraphQL do Instagram (Replies)');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allEdges: any[] = data?.data?.xdt_shortcode_media?.edge_media_to_parent_comment?.edges || [];
    
    // Find the target comment
    const targetComment = allEdges.find((e: any) => e.node?.id === comment_id);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const replyEdges: any[] = targetComment?.node?.edge_threaded_comments?.edges || [];
    const replyCount: number = targetComment?.node?.edge_threaded_comments?.count || 0;
    const replyPageInfo = targetComment?.node?.edge_threaded_comments?.page_info || {};

    return NextResponse.json({
      replies: replyEdges.map(mapReply),
      count: replyCount,
      nextCursor: replyPageInfo.has_next_page ? replyPageInfo.end_cursor : null,
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Replies Error:', error);
    if (error.message === 'RATE_LIMIT') {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
    }
    return NextResponse.json({ error: error.message || 'Erro interno ao buscar respostas' }, { status: 500 });
  }
}
