import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { ActiveSessions } from '#/components/block/active-sessions'
import type { ActiveSession } from '#/components/block/active-sessions'
import { Alert } from '#/components/arc/alert/alert'
import { Button } from '#/components/arc/button/button'
import { CopyButton } from '#/components/arc/copy-button/copy-button'
import { Input } from '#/components/arc/input/input'
import { PasswordField } from '#/components/arc/password-field/password-field'
import { PasswordStrength } from '#/components/arc/password-strength/password-strength'
import styles from './account.module.css'
import { authMessage } from '#/lib/auth-message'
import { authClient } from '#/lib/auth-client'
import { blobToBase64 } from '#/lib/avatar-image'
import { getPasswordStatus, uploadAvatar } from '#/lib/profile'
import { ProfilePhoto } from '#/components/profile-photo/profile-photo'
import { describeClient } from '#/lib/session-device'
import { loadShareSettings, saveProfile } from '#/lib/wishlist/account'

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [{ title: 'Account' }, { name: 'robots', content: 'noindex' }],
  }),
  component: AccountPage,
})

function AccountPage() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const user = session?.user

  useEffect(() => {
    if (!isPending && !user) void navigate({ to: '/sign-in' })
  }, [isPending, navigate, user])

  if (!user) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <Link to="/" className={styles.back}>
            Back to your list
          </Link>
          <h1>Account</h1>
        </header>
        <p className={styles.note}>Loading your account.</p>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>
          Back to your list
        </Link>
        <h1>Account</h1>
      </header>
      <ProfileForm
        name={user.name}
        email={user.email}
        username={user.username ?? ''}
        image={user.image}
      />
      <PasswordForm email={user.email} />
      <SessionsPanel currentId={session.session.id} />
      <ShareLink username={user.username ?? ''} />
    </main>
  )
}

function ProfileForm({
  name: initialName,
  email: initialEmail,
  username: initialUsername,
  image,
}: {
  name: string
  email: string
  username: string
  image?: string | null
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [username, setUsername] = useState(initialUsername)
  const [photo, setPhoto] = useState(image ?? '')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState('Save changes')
  // r7 (Q4): the cover note's bio (C11) and FOR line (C12).
  const [about, setAbout] = useState({ bio: '', forLine: '' })
  const [savedAbout, setSavedAbout] = useState({ bio: '', forLine: '' })

  useEffect(() => {
    let cancelled = false
    loadShareSettings()
      .then((result) => {
        if (cancelled || !result.ok) return
        const next = { bio: result.bio, forLine: result.forLine }
        setAbout(next)
        setSavedAbout(next)
      })
      .catch(() => {
        // Fields stay empty; saving still writes them.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setName(initialName)
    setEmail(initialEmail)
    setUsername(initialUsername)
    setPhoto(image ?? '')
  }, [image, initialEmail, initialName, initialUsername])

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSaving(true)
    setLabel('Saving')
    const nextName = name.trim()
    const nextUsername = username.trim()
    const nextEmail = email.trim()
    const profile: { name?: string; username?: string } = {}
    if (nextName !== initialName) profile.name = nextName
    if (nextUsername !== initialUsername) profile.username = nextUsername
    if (
      about.bio.trim() !== savedAbout.bio ||
      about.forLine.trim() !== savedAbout.forLine
    ) {
      const result = await saveProfile({ data: about }).catch(() => null)
      if (!result?.ok) {
        setSaving(false)
        setLabel('Save changes')
        setError(result?.message ?? 'Your changes were not saved.')
        return
      }
      const next = { bio: result.bio, forLine: result.forLine }
      setAbout(next)
      setSavedAbout(next)
    }
    if (profile.name || profile.username) {
      const result = await authClient.updateUser(profile)
      if (result.error) {
        setSaving(false)
        setLabel('Save changes')
        setError(authMessage(result.error, 'Your changes were not saved.'))
        return
      }
    }
    if (nextEmail !== initialEmail) {
      const result = await authClient.changeEmail({
        newEmail: nextEmail,
        callbackURL: '/account',
      })
      setSaving(false)
      setLabel('Save changes')
      if (result.error) {
        setError(authMessage(result.error, 'The email was not changed.'))
        return
      }
      setNotice('Check your inbox to confirm the new email.')
      return
    }
    setSaving(false)
    setLabel('Saved')
  }

  return (
    <section className={styles.section} aria-labelledby="profile-heading">
      <h2 id="profile-heading">Profile</h2>
      <ProfilePhoto
        name={name || 'Account'}
        src={photo || undefined}
        onUpload={async (image) => {
          const imageBase64 = await blobToBase64(image)
          const stored = await uploadAvatar({ data: { imageBase64 } })
          if (!stored.ok) throw new Error(stored.message)
          const updated = await authClient.updateUser({ image: stored.url })
          if (updated.error) {
            throw new Error(
              updated.error.message ??
                'The photo was not saved on your profile.',
            )
          }
          setPhoto(stored.url)
        }}
      />
      <form className={styles.form} onSubmit={(event) => void save(event)}>
        <Input
          label="Name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setLabel('Save changes')
          }}
        />
        <Input
          label="Username"
          name="username"
          autoComplete="username"
          description="This is the public link for your wishlist."
          value={username}
          onChange={(event) => {
            setUsername(event.target.value)
            setLabel('Save changes')
          }}
        />
        <Input
          label="Bio"
          name="bio"
          placeholder="Tell friends a bit about what you like"
          maxLength={70}
          value={about.bio}
          onChange={(event) => {
            setAbout({ ...about, bio: event.target.value })
            setLabel('Save changes')
          }}
        />
        <Input
          label="Who or what it's for"
          name="forLine"
          placeholder="My birthday"
          maxLength={12}
          value={about.forLine}
          onChange={(event) => {
            setAbout({ ...about, forLine: event.target.value })
            setLabel('Save changes')
          }}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setLabel('Save changes')
          }}
        />
        {error ? (
          <Alert tone="danger" title="Changes not saved">
            {error}
          </Alert>
        ) : null}
        {notice ? (
          <Alert tone="info" title="Confirm your email">
            {notice}
          </Alert>
        ) : null}
        <div>
          <Button type="submit" loading={saving}>
            {label}
          </Button>
        </div>
      </form>
    </section>
  )
}

function PasswordForm({ email }: { email: string }) {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPasswordStatus()
      .then((result) => {
        if (!cancelled) setHasPassword(result.hasPassword)
      })
      .catch(() => {
        if (!cancelled) setHasPassword(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function change(event: FormEvent) {
    event.preventDefault()
    if (level < 3) {
      setError('Choose a stronger password.')
      return
    }
    setError(null)
    setNotice(null)
    setLoading(true)
    const result = await authClient.changePassword({
      currentPassword,
      newPassword: password,
      revokeOtherSessions: true,
    })
    setLoading(false)
    if (result.error) {
      setError(authMessage(result.error, 'The password was not changed.'))
      return
    }
    setCurrentPassword('')
    setPassword('')
    setLevel(0)
    setNotice('Password saved. Other sessions were signed out.')
  }

  async function sendLink() {
    setError(null)
    setNotice(null)
    setLoading(true)
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    })
    setLoading(false)
    if (result.error) {
      setError(authMessage(result.error, 'The reset email could not be sent.'))
      return
    }
    setNotice(
      'If this inbox can receive mail, a link to set your password is on its way.',
    )
  }

  return (
    <section className={styles.section} aria-labelledby="password-heading">
      <h2 id="password-heading">Password</h2>
      {hasPassword === null ? (
        <p className={styles.note}>Loading password settings.</p>
      ) : hasPassword ? (
        <form className={styles.form} onSubmit={(event) => void change(event)}>
          <PasswordField
            label="Current password"
            name="current-password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          <PasswordStrength
            label="New password"
            name="new-password"
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
          {notice ? (
            <Alert tone="success" title="Password saved">
              {notice}
            </Alert>
          ) : null}
          <div>
            <Button
              type="submit"
              variant="secondary"
              loading={loading}
              disabled={level < 3}
            >
              Change password
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.form}>
          <p className={styles.note}>
            This account signs in with Google. Email a link if you also want a
            password.
          </p>
          {error ? (
            <Alert tone="danger" title="Email not sent">
              {error}
            </Alert>
          ) : null}
          {notice ? (
            <Alert tone="success" title="Check your inbox">
              {notice}
            </Alert>
          ) : null}
          <div>
            <Button
              type="button"
              variant="secondary"
              loading={loading || hasPassword === null}
              onClick={() => void sendLink()}
            >
              Email a password link
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function SessionsPanel({ currentId }: { currentId: string }) {
  const [sessions, setSessions] = useState<Array<ActiveSession>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const tokens = useRef<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    authClient
      .listSessions()
      .then((result) => {
        if (cancelled) return
        if (result.error || !result.data) {
          setError('Sessions could not be loaded. Sign in again and retry.')
          setLoading(false)
          return
        }
        const nextTokens: Record<string, string> = {}
        const next = result.data.map((row) => {
          const located = row as typeof row & {
            city?: string | null
            country?: string | null
          }
          nextTokens[row.id] = row.token
          const described = describeClient(row.userAgent)
          const location = [located.city, located.country]
            .filter((part): part is string => Boolean(part))
            .join(', ')
          return {
            id: row.id,
            device: described.device,
            browser: described.browser,
            os: described.os,
            location: location || undefined,
            ip: row.ipAddress ?? undefined,
            lastActiveAt: row.updatedAt,
            current: row.id === currentId,
          }
        })
        tokens.current = nextTokens
        setSessions(next)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Sessions could not be loaded.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentId])

  return (
    <section className={styles.section}>
      {error ? (
        <Alert tone="danger" title="Sessions unavailable">
          {error}
        </Alert>
      ) : (
        <ActiveSessions
          heading="Sessions"
          headingLevel={2}
          description="Devices signed in to your account. Sign out any you do not recognize."
          sessions={sessions}
          onSessionsChange={setSessions}
          loading={loading}
          onRevoke={async (row) => {
            const token = tokens.current[row.id]
            if (!token) throw new Error('That session could not be signed out.')
            const result = await authClient.revokeSession({ token })
            if (result.error)
              throw new Error('That session could not be signed out.')
          }}
          onRevokeOthers={async () => {
            const result = await authClient.revokeOtherSessions()
            if (result.error) {
              throw new Error('The other sessions could not be signed out.')
            }
          }}
        />
      )}
    </section>
  )
}

function ShareLink({ username }: { username: string }) {
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])
  const href = username && origin ? `${origin}/u/${username}` : ''
  return (
    <section className={styles.section} aria-labelledby="share-heading">
      <h2 id="share-heading">Share</h2>
      {href ? (
        <div className={styles.share}>
          <p className={styles.note}>{href}</p>
          <CopyButton value={href} label="Copy link" />
        </div>
      ) : (
        <p className={styles.note}>Choose a username to share your wishlist.</p>
      )}
    </section>
  )
}
