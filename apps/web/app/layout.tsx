import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Manrope, Sora } from 'next/font/google';
import './globals.css';
import GlobalNav from './global-nav';
import { isAuthenticated } from './lib/auth';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
});

const displayFont = Sora({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Clippr - Stream naar Shorts',
  description: 'AI SaaS voor automatische highlight clips uit YouTube livestreams.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isAuthed = isAuthenticated(cookieStore);

  return (
    <html lang="nl">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <GlobalNav isAuthed={isAuthed} />
        {children}
      </body>
    </html>
  );
}
