
import type { NextRequest } from 'next/server';
import { createParser, EventSourceParseCallback } from 'eventsource-parser';

export const config = {
  runtime: 'edge',
};

const apiKey = process.env.OPENAI_API_KEY;
const url = 'https://lnkcast.com/v1/chat/completions';


async function handler(req: NextRequest) {
  const body = await req.json();
  const messages = body.messages;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (!messages) {
    return new Response('请输入文本');
  }
  console.log(messages);
  const startTime = Date.now();
  try {
    const result = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      keepalive: true,
      method: 'POST',
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.6,
        stream: true,
      }),
    });
    const headers = new Headers();
    result.headers.forEach((value, key) => {
      headers.append(key, value);
    });
    const ms = Date.now() - startTime;
    headers.append('Server-Timing', `fetch;dur=${ms}`);

    const stream = new ReadableStream({
      async start(controller) {
        const streamParser: EventSourceParseCallback = (event) => {
          if (event.type === 'event') {
            const data = event.data
            if (data === '[DONE]') {
              controller.close()
              return
            }
            try {
              // response = {
              //   id: 'chatcmpl-6pULPSegWhFgi0XQ1DtgA3zTa1WR6',
              //   object: 'chat.completion.chunk',
              //   created: 1677729391,
              //   model: 'gpt-3.5-turbo-0301',
              //   choices: [
              //     { delta: { content: '你' }, index: 0, finish_reason: null }
              //   ],
              // }
              const json = JSON.parse(data)
              const text = json.choices[0].delta?.content
              const queue = encoder.encode(text)
              controller.enqueue(queue)
            } catch (e) {
              controller.error(e)
            }
          }
        }

        const parser = createParser(streamParser)
        for await (const chunk of result.body as any) {
          parser.feed(decoder.decode(chunk))
        }
      },
    })

    const response = new Response(stream, {
      headers,
      status: 200,
      statusText: 'success',
    });
    return response;
  } catch (error) {
    console.error(error);
    const headers = new Headers();
    const ms = Date.now() - startTime;
    headers.append('Server-Timing', `fetch;dur=${ms}`);
    return new Response(JSON.stringify(error), {
      headers,
      status: 500,
      statusText: 'error',
    });
  }
}

export default handler;
