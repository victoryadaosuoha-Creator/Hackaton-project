import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { LanguageSwitch } from '@/components/system/LanguageSwitch'
import { ButtonLink } from '@/components/ui/Button'
import { useI18n } from '@/i18n/LanguageContext'

export function PublicHeader() {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/how-it-works', label: t('nav.how') },
    { to: '/map', label: t('nav.map') },
    { to: '/about', label: t('nav.about') },
    { to: '/track', label: t('nav.track') },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-white/40 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-brand-800 lg:flex" aria-label="Primary">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'text-brand-900' : 'text-brand-700 hover:text-brand-900')}
              end={link.to === '/'}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitch />
          <ButtonLink to="/signin" variant="ghost" size="sm">
            {t('nav.signin')}
          </ButtonLink>
          <ButtonLink to="/get-started" size="sm">
            {t('nav.start')}
          </ButtonLink>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-brand-800 lg:hidden"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open ? (
        <div className="space-y-2 border-t border-line bg-white px-4 py-3 lg:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className="block rounded-lg px-2 py-2 text-sm font-semibold text-brand-800"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
          <LanguageSwitch />
          <ButtonLink to="/signin" variant="outline" className="w-full">
            {t('nav.signin')}
          </ButtonLink>
          <ButtonLink to="/get-started" className="w-full">
            {t('nav.start')}
          </ButtonLink>
        </div>
      ) : null}
    </header>
  )
}
