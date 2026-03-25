import { NextResponse } from 'next/server';

export const maxDuration = 30;

const TOKEN = process.env.APIFY_TOKEN;
// Utiliza o ator dedicado para comentários (Apify oficial), que ignora o limite de 15 itens
const ACTOR_ID = 'apify~instagram-comment-scraper';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('instagram.com')) {
      return NextResponse.json({ error: 'URL do Instagram inválida' }, { status: 400 });
    }

    // Inicia run ASSÍNCRONO no instagram-comment-scraper
    const startRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          directUrls: [url],
          // Configurações fortes para pegar tudo
          resultsLimit: 10000, 
        }),
      }
    );

    if (!startRes.ok) {
      const err = await startRes.text().catch(() => '');
      return NextResponse.json({ error: `Falha ao iniciar scraper: ${err}` }, { status: startRes.status });
    }

    const startData = await startRes.json();
    const runId: string = startData.data?.id;
    const datasetId: string = startData.data?.defaultDatasetId;

    if (!runId) {
      return NextResponse.json({ error: 'Falha ao obter runId do Apify' }, { status: 500 });
    }

    return NextResponse.json({ runId, datasetId, status: 'RUNNING' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Analyze Error:', error);
    return NextResponse.json({ error: 'Erro interno ao iniciar análise' }, { status: 500 });
  }
}
