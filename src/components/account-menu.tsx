import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { MoonIcon, SunIcon, UserIcon } from '@phosphor-icons/react'

import { authClient } from '#/lib/auth-client'
import { getGoogleAuthReady } from '#/lib/auth-status'

export function AccountMenu() {
  const { data: session, isPending } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const [googleReady, setGoogleReady] = useState<boolean | null>(null)
  const [signInError, setSignInError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const user = session?.user

  useEffect(() => {
    let cancelled = false
    getGoogleAuthReady()
      .then((result) => {
        if (!cancelled) setGoogleReady(result.ready)
      })
      .catch(() => {
        if (!cancelled) setGoogleReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = user?.name ? `${user.name}, account` : 'Account'

  return (
    <div className="account-anchor">
      <ThemeToggle />
      <div className="account-menu-root" ref={rootRef}>
      <button
        type="button"
        className="account-avatar"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        {user?.image ? (
          <img src={user.image} alt="" referrerPolicy="no-referrer" />
        ) : (
          <UserIcon size={18} weight={isPending ? 'regular' : 'bold'} />
        )}
      </button>
      {open ? (
        <div id={menuId} role="menu" className="account-menu">
          {user ? (
            <>
              <p className="account-name">{user.name}</p>
              <p className="account-email">{user.email}</p>
              <button
                type="button"
                role="menuitem"
                className="account-sign-out"
                onClick={() => {
                  void authClient.signOut()
                  setOpen(false)
                }}
              >
                Sign out
              </button>
            </>
          ) : googleReady ? (
            <button
              type="button"
              role="menuitem"
              className="google-sign-in"
              onClick={() => {
                setSignInError(null)
                void authClient.signIn
                  .social({ provider: 'google', callbackURL: '/' })
                  .catch(() => {
                    setSignInError('Google sign-in did not start.')
                  })
              }}
            >
              <GoogleMark />
              Sign in with Google
            </button>
          ) : (
            <p className="account-note">
              Google sign-in needs a client ID and secret in this app. Add them
              to <code>.dev.vars</code>, then allow{' '}
              <code>http://localhost:3000/api/auth/callback/google</code> on the
              OAuth client.
            </p>
          )}
          {signInError ? (
            <p role="alert" className="account-error">
              {signInError}
            </p>
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useLayoutEffect(() => {
    const root = document.documentElement
    const saved = localStorage.getItem('theme')
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (next: 'light' | 'dark') => {
      root.dataset.theme = next
      setTheme(next)
    }
    apply(saved === 'dark' || (!saved && media.matches) ? 'dark' : 'light')
    const onSystem = () => {
      if (localStorage.getItem('theme')) return
      apply(media.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', onSystem)
    return () => media.removeEventListener('change', onSystem)
  }, [])

  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={next === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={() => {
        document.documentElement.dataset.theme = next
        localStorage.setItem('theme', next)
        setTheme(next)
      }}
    >
      {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}
