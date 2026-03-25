import { NextResponse } from 'next/server';

const TOKEN = process.env.APIFY_TOKEN;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');

  if (!runId) {
    return NextResponse.json({ error: 'runId obrigatório' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`);
    const data = await res.json();
    const run = data.data;

    return NextResponse.json({
      status: run?.status,               // RUNNING, SUCCEEDED, FAILED, TIMED_OUT
      datasetId: run?.defaultDatasetId,
      itemCount: run?.stats?.itemsWritten || 0,
    });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Status Error:', error);
    return NextResponse.json({ error: 'Erro ao verificar status' }, { status: 500 });
  }
}
