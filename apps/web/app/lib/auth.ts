import type { RequestCookies } from 'next/dist/compiled/@edge-runtime/cookies';

export const AUTH_COOKIE_NAME = 'clippr_session';
const AUTH_COOKIE_VALUE = 'authenticated';

function expectedEmail(): string {
  return process.env.CLIPPR_ADMIN_EMAIL ?? 'admin';
}

function expectedPassword(): string {
  return process.env.CLIPPR_ADMIN_PASSWORD ?? 'admin';
}

export function isValidCredentials(email: string, password: string): boolean {
  return email === expectedEmail() && password === expectedPassword();
}

export function isAuthenticated(cookiesStore: Pick<RequestCookies, 'get'>): boolean {
  return cookiesStore.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
}

export function authCookieValue(): string {
  return AUTH_COOKIE_VALUE;
}
