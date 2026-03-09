import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/boxes', label: 'Boxes' },
  { to: '/pick-list', label: 'Pick List' },
] as const

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="text-base font-semibold tracking-tight text-slate-900 no-underline dark:text-slate-100"
        >
          TCG Index
        </Link>

        <div className="ml-2 hidden items-center gap-4 sm:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-medium text-slate-600 no-underline transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              activeProps={{ className: 'text-sm font-medium text-emerald-700 no-underline dark:text-emerald-400' }}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
