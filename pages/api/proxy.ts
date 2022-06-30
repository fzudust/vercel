import type { NextRequest } from 'next/server';

export const config = {
  runtime: 'experimental-edge',
}

const noResHeaders = [
  'transfer-encoding',
  'content-encoding',
  'x-frame-options',
];

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const url: string = searchParams.get('url') || '';
  if (!url) {
    return new Response('null');
  }
  const { origin } = new URL(url)
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
    const headers = new Headers();
    result.headers.forEach((value, key) => {
      if (!noResHeaders.includes(key.toLowerCase())) {
        headers.append(key, value);
      }
    })
    const ms = Date.now() - startTime;
    headers.append('Server-Timing', `fetch;dur=${ms}`);
    const response = new Response(data, {
      headers,
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
