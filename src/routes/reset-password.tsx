import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { Alert } from '#/components/arc/alert/alert'
import { Button } from '#/components/arc/button/button'
import { Input } from '#/components/arc/input/input'
import { PasswordStrength } from '#/components/arc/password-strength/password-strength'
import styles from '#/components/auth/auth.module.css'
import { authMessage } from '#/lib/auth-message'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>) => {
    const token = typeof search.token === 'string' ? search.token : ''
    const error = typeof search.error === 'string' ? search.error : ''
    return {
      ...(token ? { token } : {}),
      ...(error ? { error } : {}),
    }
  },
  head: () => ({
    meta: [
      { title: 'Reset password' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token = '', error: linkError = '' } = Route.useSearch()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(
    linkError ? 'This reset link has expired. Request a new one.' : null,
  )
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function requestLink(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    const result = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: '/reset-password',
    })
    setLoading(false)
    if (result.error) {
      setError(
        authMessage(result.error, 'The reset email could not be sent.'),
      )
      return
    }
    setSent(true)
  }

  async function choosePassword(event: FormEvent) {
    event.preventDefault()
    if (level < 3) {
      setError('Choose a stronger password.')
      return
    }
    setError(null)
    setLoading(true)
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    setLoading(false)
    if (result.error) {
      setError(authMessage(result.error, 'The password was not changed.'))
      return
    }
    void navigate({ to: '/sign-in' })
  }

  return (
    <main className={styles.page}>
      <h1>Reset password</h1>
      {token ? (
        <form className={styles.form} onSubmit={(event) => void choosePassword(event)}>
          <PasswordStrength
            label="New password"
            name="password"
            autoComplete="new-password"
            value={password}
            onValueChange={(value, strength) => {
              setPassword(value)
              setLevel(strength.level)
            }}
          />
          {error ? (
            <Alert tone="danger" title="Password not changed">
              {error}
            </Alert>
          ) : null}
          <Button type="submit" loading={loading} disabled={level < 3}>
            Save password
          </Button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={(event) => void requestLink(event)}>
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {error ? (
            <Alert tone="danger" title="Reset email not sent">
              {error}
            </Alert>
          ) : null}
          {sent ? (
            <Alert tone="success" title="Check your inbox">
              If an account uses that email, a reset link is on its way.
            </Alert>
          ) : null}
          <Button type="submit" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}
      <p className={styles.links}>
        <Link to="/sign-in">Sign in</Link>
      </p>
    </main>
  )
}
