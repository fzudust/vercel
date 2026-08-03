import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.append('server', 'proxy')
  response.headers.append('Access-Control-Allow-Origin', `*`);
  return response;
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/api/proxy',
}
