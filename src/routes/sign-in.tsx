import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { Alert } from '#/components/arc/alert/alert'
import { Button } from '#/components/arc/button/button'
import { Input } from '#/components/arc/input/input'
import { PasswordField } from '#/components/arc/password-field/password-field'
import { GoogleMark } from '#/components/auth/google-mark'
import styles from '#/components/auth/auth.module.css'
import { authMessage } from '#/lib/auth-message'
import { authClient } from '#/lib/auth-client'
import { getGoogleAuthReady } from '#/lib/auth-status'

export const Route = createFileRoute('/sign-in')({
  head: () => ({
    meta: [
      { title: 'Sign in' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    if (session?.user) void navigate({ to: '/' })
  }, [navigate, session?.user])

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

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const value = identity.trim()
    const result = value.includes('@')
      ? await authClient.signIn.email({
          email: value,
          password,
          callbackURL: '/',
        })
      : await authClient.signIn.username({
          username: value,
          password,
          callbackURL: '/',
        })
    setLoading(false)
    if (result.error) {
      setError(authMessage(result.error, 'Sign in did not complete.'))
      return
    }
    void navigate({ to: '/' })
  }

  return (
    <main className={styles.page}>
      <h1>Sign in</h1>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Input
          label="Email or username"
          name="username"
          autoComplete="username"
          value={identity}
          onChange={(event) => setIdentity(event.target.value)}
          required
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? (
          <Alert tone="danger" title="Sign in failed">
            {error}
          </Alert>
        ) : null}
        <Button type="submit" loading={loading}>
          Sign in
        </Button>
      </form>
      {googleReady ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setError(null)
            void authClient.signIn
              .social({ provider: 'google', callbackURL: '/' })
              .catch(() => {
                setError('Google sign-in did not start.')
              })
          }}
        >
          <GoogleMark /> Continue with Google
        </Button>
      ) : null}
      <p className={styles.links}>
        <Link to="/sign-up">Create account</Link>
        <Link to="/reset-password">Reset password</Link>
      </p>
    </main>
  )
}
