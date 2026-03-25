import { NextResponse } from 'next/server';

export const maxDuration = 30;

const TOKEN = process.env.APIFY_TOKEN;
// Usa a Task do usuário, para manter as configurações de proxy/cookies feitas no painel do Apify
const TASK_ID = 'humbertomatheuz~instagram-scraper-task';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('instagram.com')) {
      return NextResponse.json({ error: 'URL do Instagram inválida' }, { status: 400 });
    }

    // Inicia run ASSÍNCRONO na Task do usuário
    const startRes = await fetch(
      `https://api.apify.com/v2/actor-tasks/${TASK_ID}/runs?token=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          directUrls: [url],
          // Omitindo type/limit para respeitar a configuração "resultsType": "comments" salva na Task dele no Apify,
          // pois isso permite ele customizar na web sem ter o backend sobrescrevendo.
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
