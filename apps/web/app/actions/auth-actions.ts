'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE_NAME, authCookieValue, isValidCredentials } from '../lib/auth';

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/clips');

  if (!isValidCredentials(email, password)) {
    redirect('/login?error=invalid_credentials');
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, authCookieValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(next.startsWith('/') ? next : '/clips');
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect('/login');
}
