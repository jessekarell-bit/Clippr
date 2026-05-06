'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '24px',
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Clippr</h1>
      <p style={{ color: '#888', maxWidth: '400px', textAlign: 'center' }}>
        Automatically generate viral clips from your YouTube live streams
      </p>
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        style={{
          padding: '12px 24px',
          background: '#ff0000',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1rem',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Connect with YouTube
      </button>
    </div>
  );
}
