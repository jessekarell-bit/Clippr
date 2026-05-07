'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/clips', label: 'Generated clips', icon: '✂', badge: '42' },
  { href: '/streams', label: 'Stream ingest', icon: '◉', badge: '2' },
  { href: '/pipeline', label: 'AI pipeline', icon: '⚙', badge: '7' },
  { href: '/publishing', label: 'Publishing', icon: '↗', badge: '17' },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="dashboard-nav">
      {navItems.map((item) => {
        const isActive = item.href === '/clips' ? pathname.startsWith('/clips') : pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`dashboard-nav-item${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="dashboard-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
            <span className="dashboard-nav-badge">{item.badge}</span>
          </Link>
        );
      })}
    </nav>
  );
}
