import { login } from '../actions/auth-actions';

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === 'invalid_credentials';
  const next = params.next ?? '/clips';

  return (
    <main className="site login-page">
      <section className="login-card card">
        <p className="badge">Beveiligde toegang</p>
        <h1>Inloggen op het Clippr dashboard</h1>
        <p className="subtitle">Log in om je clips, streams en publicaties te beheren.</p>

        {hasError ? <p className="error-text">Inloggegevens kloppen niet. Probeer opnieuw.</p> : null}

        <form action={login} className="login-form">
          <input type="hidden" name="next" value={next} />
          <label>
            <span className="muted">Email</span>
            <input name="email" type="text" placeholder="admin" required />
          </label>
          <label>
            <span className="muted">Password</span>
            <input name="password" type="password" placeholder="••••••••" required />
          </label>
          <button type="submit" className="button primary">
            Inloggen
          </button>
        </form>
      </section>
    </main>
  );
}
