import axios, { AxiosRequestConfig } from 'axios';
import { NextApiRequest, NextApiResponse } from 'next'
import https from 'https';

const httpsAgent = new https.Agent({ keepAlive: true })

const axiosConfig: AxiosRequestConfig = {
  responseType: 'document',
  httpsAgent,
  headers: {
    'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36",
  }
};
const instance = axios.create(axiosConfig);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const url: string = req.query.url as string;
  const start = Date.now();
  try {
    const result = await instance.get<string>(url);
    const origin = new URL(url).origin;
    for (const key in result.headers) {
      if (
        !['transfer-encoding', 'x-frame-options'].includes(key.toLowerCase())
      ) {
        res.setHeader(key, result.headers[key]);
      }
    }
    const data: string = result.data
      .replace(/<script/gi, '<noscript')
      .replace(/<script/gi, '<noscript')
      .replace(/<\/script>/gi, '</noscript>')
      .replace(/<head>/gi, `<head><base href="${origin}" />`)
      .replace(/<\/head>/gi, `<link href="https://vercel-fzudust.vercel.app/iframe.css" rel="stylesheet"></head>`);
    const ms = Date.now() - start;
    res.setHeader('Server-Timing', `net;dur=${ms}`);
    res.setHeader('Access-Control-Allow-Origin', `*`);
    // res.status(200);
    res.send(data);
  } catch (error) {
    console.error(error)
    res.send(error);
  }
}

export default handler;
