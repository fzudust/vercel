import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.append('server', 'middleware')
  response.headers.append('Access-Control-Allow-Origin', `*`);
  return response;
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/api/proxy',
}
