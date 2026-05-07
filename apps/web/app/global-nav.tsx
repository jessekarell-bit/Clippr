import Link from 'next/link';

interface GlobalNavProps {
  isAuthed: boolean;
}

export default function GlobalNav({ isAuthed }: GlobalNavProps) {
  const links = [
    { href: '/', label: 'Home' },
    { href: '/demo', label: 'Demo' },
    ...(isAuthed
      ? [
          { href: '/clips', label: 'Clips' },
          { href: '/streams', label: 'Streams' },
          { href: '/pipeline', label: 'Pipeline' },
          { href: '/publishing', label: 'Publishing' },
        ]
      : []),
    ...(isAuthed ? [] : [{ href: '/login', label: 'Login' }]),
  ];

  return (
    <nav className="global-nav">
      <div className="global-nav-inner">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="global-nav-link">
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
