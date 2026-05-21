import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const user = process.env.DASHBOARD_USER
  const pass = process.env.DASHBOARD_PASS
  if (!user || !pass) return NextResponse.next()

  const auth = request.headers.get('authorization')
  const expected = 'Basic ' + btoa(`${user}:${pass}`)
  if (auth !== expected) {
    return new NextResponse('Acceso no autorizado', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Seeds Dashboard"' },
    })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
