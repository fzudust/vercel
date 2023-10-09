import type { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
}

const SECRET_KEY = process.env.SECRET_KEY || '1x0000000000000000000000000000000AA';
const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    // Turnstile injects a token in "cf-turnstile-response".
    const token: string = body.token || '';
    const ip: string = req.ip || '';
    let formData = new FormData();
    formData.append('secret', SECRET_KEY);
    formData.append('response', token);
    formData.append('remoteip', ip);
    const idempotencyKey = crypto.randomUUID();
    formData.append('idempotency_key', idempotencyKey);
    const result = await fetch(url, {
      body: formData,
      method: 'POST',
    });
    const outcome = await result.json();
    return new Response(JSON.stringify(outcome));
    /* if (!outcome.success) {
      return new Response('The provided Turnstile token was not valid! \n' + JSON.stringify(outcome));
    }
    return new Response('Turnstile token successfuly validated. \n' + JSON.stringify(outcome)); */
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify(error), {
      status: 500,
      statusText: 'error',
    });
  }
}

export default handler;
