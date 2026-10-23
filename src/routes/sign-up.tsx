import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { Alert } from '#/components/arc/alert/alert'
import { Button } from '#/components/arc/button/button'
import { Input } from '#/components/arc/input/input'
import { PasswordStrength } from '#/components/arc/password-strength/password-strength'
import { GoogleMark } from '#/components/auth/google-mark'
import styles from '#/components/auth/auth.module.css'
import { authMessage } from '#/lib/auth-message'
import { authClient } from '#/lib/auth-client'
import { getGoogleAuthReady } from '#/lib/auth-status'

export const Route = createFileRoute('/sign-up')({
  head: () => ({
    meta: [
      { title: 'Create account' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: SignUpPage,
})

function SignUpPage() {
  const navigate = useNavigate()
  const { data: session } = authClient.useSession()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [level, setLevel] = useState(0)
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
    if (level < 3) {
      setError('Choose a stronger password before creating the account.')
      return
    }
    setError(null)
    setLoading(true)
    const result = await authClient.signUp.email({
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      password,
      callbackURL: '/',
    })
    setLoading(false)
    if (result.error) {
      setError(authMessage(result.error, 'The account could not be created.'))
      return
    }
    void navigate({ to: '/' })
  }

  return (
    <main className={styles.page}>
      <h1>Create account</h1>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <Input
          label="Name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <Input
          label="Username"
          name="username"
          autoComplete="username"
          description="3 to 30 letters, numbers, or underscores. This becomes your public link."
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <PasswordStrength
          label="Password"
          name="password"
          autoComplete="new-password"
          value={password}
          onValueChange={(value, strength) => {
            setPassword(value)
            setLevel(strength.level)
          }}
        />
        {error ? (
          <Alert tone="danger" title="Account not created">
            {error}
          </Alert>
        ) : null}
        <Button type="submit" loading={loading} disabled={level < 3}>
          Create account
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
        <Link to="/sign-in">Sign in</Link>
      </p>
    </main>
  )
}
