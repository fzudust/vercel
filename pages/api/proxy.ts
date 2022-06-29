import type { NextRequest } from 'next/server';

export const config = {
  runtime: 'experimental-edge',
}

async function handler(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const url: string = searchParams.get('url') || '';
  try {
    const startTime = Date.now();
    const result = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
      },
    });
    const text: string = await result.text();
    const data = text.replace(/<script/gi, '<noscript')
      .replace(/<script/gi, '<noscript')
      .replace(/<\/script>/gi, '</noscript>')
      .replace(/<head>/gi, `<head><base href="${origin}" />`)
      .replace(/<\/head>/gi, `<link href="https://vercel-fzudust.vercel.app/iframe.css" rel="stylesheet"></head>`);
    const headers = result.headers;
    headers.delete('content-encoding');
    // headers.delete('transfer-encoding');
    headers.delete('x-frame-options');
    const ms = Date.now() - startTime;
    headers.append('Server-Timing', `fetch;dur=${ms}`);
    const response = new Response(data, {
      headers: result.headers,
      status: 200,
      statusText: 'success',
    });
    return response;
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify(error));
  }
}

export default handler;
