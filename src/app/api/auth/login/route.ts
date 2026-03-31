import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { username, password, sessionId } = await request.json();

    // ── Mode 1: Manual SessionID ─────────────────────────────────────────────
    if (sessionId) {
      // Validate the session by hitting Instagram's account info endpoint
      const validateRes = await fetch('https://www.instagram.com/api/v1/accounts/current_user/?edit=true', {
        headers: {
          'Cookie': `sessionid=${sessionId}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (validateRes.ok || validateRes.status === 200) {
        const data = await validateRes.json().catch(() => ({}));
        const user = data?.user;
        return NextResponse.json({
          success: true,
          sessionId,
          username: user?.username || 'usuário',
          method: 'manual',
        });
      } else {
        return NextResponse.json({ error: 'SessionID inválido ou expirado.' }, { status: 401 });
      }
    }

    // ── Mode 2: Username + Password proxy ────────────────────────────────────
    if (!username || !password) {
      return NextResponse.json({ error: 'Credenciais obrigatórias.' }, { status: 400 });
    }

    // First, get a CSRF token from Instagram
    const initRes = await fetch('https://www.instagram.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });

    const cookies = initRes.headers.get('set-cookie') || '';
    const csrfMatch = cookies.match(/csrftoken=([^;]+)/);
    const csrf = csrfMatch ? csrfMatch[1] : 'missing';

    // Attempt login
    const loginRes = await fetch('https://www.instagram.com/accounts/login/ajax/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'X-CSRFToken': csrf,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.instagram.com/',
        'Origin': 'https://www.instagram.com',
      },
      body: new URLSearchParams({
        username,
        enc_password: `#PWD_INSTAGRAM_BROWSER:0:${Date.now()}:${password}`,
        queryParams: '{}',
        optIntoOneTap: 'false',
      }).toString(),
    });

    const responseCookies = loginRes.headers.get('set-cookie') || '';
    const sessionIdMatch = responseCookies.match(/sessionid=([^;]+)/);
    const newSessionId = sessionIdMatch ? sessionIdMatch[1] : null;

    const loginData = await loginRes.json().catch(() => ({}));

    if (loginData.authenticated && newSessionId) {
      return NextResponse.json({
        success: true,
        sessionId: newSessionId,
        username: loginData.userId ? username : username,
        method: 'credentials',
      });
    }

    // Handle checkpoint / two-factor
    if (loginData.checkpoint_url || loginData.two_factor_required) {
      return NextResponse.json({
        error: 'Login requer verificação adicional (2FA ou checkpoint). Por favor, insira o SessionID manualmente.',
        requiresManual: true,
      }, { status: 403 });
    }

    return NextResponse.json({
      error: loginData.message || 'Credenciais incorretas ou bloqueio de IP. Tente inserir o SessionID manualmente.',
      requiresManual: true,
    }, { status: 401 });

  } catch (err) {
    console.error('Auth error:', err);
    return NextResponse.json({
      error: 'Erro interno. Por favor, insira o SessionID manualmente.',
      requiresManual: true,
    }, { status: 500 });
  }
}
