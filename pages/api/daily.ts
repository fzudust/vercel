import type { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const formatData = async (json: { data: { datetime: any; imageurl: any; }; }) => {
  const {
    datetime,
    imageurl,
  } = json.data;
  const result = await fetch(imageurl, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
    },
  });
  const buffer = await result.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return {
    datetime,
    imageurl,
    base64,
  }
}

const url = 'https://api.03c3.cn/api/zb?type=jsonImg';

async function handler(req: NextRequest) {
  try {
    const startTime = Date.now();
    const result = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36'
      },
    });
    const json = await result.json();
    const data = await formatData(json);
    const headers = new Headers();
    const ms = Date.now() - startTime;
    headers.append('Server-Timing', `fetch;dur=${ms}`);

    const response = new Response(JSON.stringify(data), {
      headers,
      status: 200,
      statusText: 'success',
    });
    return response;
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify(error), {
      status: 500,
      statusText: 'error',
    });
  }
}

export default handler;
