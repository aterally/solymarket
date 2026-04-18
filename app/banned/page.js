'use client';
import { signOut } from 'next-auth/react';

export default function BannedPage() {
  return (
    <div className="sign-in-page">
      <div className="sign-in-logo">solymarket</div>
      <div className="sign-in-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🚫</div>
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.95rem' }}>You have been banned</div>
        <div style={{ color: 'var(--text2)', fontSize: '0.8rem', marginBottom: 20, lineHeight: 1.5 }}>
          Your account has been suspended from solymarket.
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }} onClick={() => signOut({ callbackUrl: '/' })}>
          Sign out
        </button>
      </div>
    </div>
  );
}
