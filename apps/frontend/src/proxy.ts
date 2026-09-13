import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/auth/sign-in(.*)',
  '/auth/sign-up(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/api(.*)',
]);

const isAuthRoute = createRouteMatcher([
  '/auth/sign-in(.*)',
  '/auth/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // If user is already logged in, redirect away from auth pages to /research
  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL('/research', req.url));
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};