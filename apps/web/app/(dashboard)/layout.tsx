import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { logout } from '../actions/auth-actions';
import { isAuthenticated } from '../lib/auth';
import DashboardNav from './dashboard-nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isAuthed = isAuthenticated(cookieStore);
  if (!isAuthed) {
    redirect('/login?next=/clips');
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link href="/" className="dashboard-brand">
          <img src="/clippr-logo.svg" alt="Clippr" className="dashboard-brand-logo" />
        </Link>
        <DashboardNav />
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <p className="muted">Creator workspace</p>
          <div className="topbar-actions">
            <Link href="/" className="button ghost">
              Home
            </Link>
            <form action={logout}>
              <button type="submit" className="button ghost">
                Logout
              </button>
            </form>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
