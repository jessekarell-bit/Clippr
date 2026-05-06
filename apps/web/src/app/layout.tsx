import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clippr — Auto Clip Generator',
  description: 'Automatically generate viral clips from your YouTube live streams',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
