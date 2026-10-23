import { useLayoutEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'

import { UserMenu } from '#/components/arc/user-menu/user-menu'
import { authClient } from '#/lib/auth-client'
import { paintTheme } from '#/lib/site'

export const commandMenuEvent = 'wishlist:command-menu'

export function AccountMenu() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()
  const user = session?.user

  useLayoutEffect(() => {
    paintTheme('light')
  }, [])

  return (
    <div className="account-anchor">
      <ShortcutHint />
      {isPending ? (
        <span className="account-avatar" aria-hidden="true" />
      ) : user ? (
        <UserMenu
          user={{
            name: user.name,
            email: user.email,
            avatarSrc: user.image ?? undefined,
          }}
          showTheme={false}
          items={[
            {
              label: 'Account',
              icon: <UserRound size={16} />,
              onSelect: () => {
                void navigate({ to: '/account' })
              },
            },
          ]}
          onSignOut={() => authClient.signOut()}
        />
      ) : (
        <Link to="/sign-in" className="account-sign-in">
          Sign in
        </Link>
      )}
    </div>
  )
}

function ShortcutHint() {
  const [mac, setMac] = useState(false)

  useLayoutEffect(() => {
    const platform = navigator.platform || ''
    const agent = navigator.userAgent || ''
    setMac(/Mac|iPhone|iPad|iPod/i.test(`${platform} ${agent}`))
  }, [])

  return (
    <button
      type="button"
      className="shortcut-hint"
      aria-label={
        mac
          ? 'Open context menu, Command K'
          : 'Open context menu, Control K'
      }
      aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
      onClick={() => {
        window.dispatchEvent(new Event(commandMenuEvent))
      }}
    >
      {mac ? <CommandKey /> : <span>Ctrl</span>}
      <span>+ K for context menu</span>
    </button>
  )
}

function CommandKey() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      fill="currentColor"
      viewBox="0 0 256 256"
      aria-hidden="true"
    >
      <path d="M180,144H160V112h20a36,36,0,1,0-36-36V96H112V76a36,36,0,1,0-36,36H96v32H76a36,36,0,1,0,36,36V160h32v20a36,36,0,1,0,36-36ZM160,76a20,20,0,1,1,20,20H160ZM56,76a20,20,0,0,1,40,0V96H76A20,20,0,0,1,56,76ZM96,180a20,20,0,1,1-20-20H96Zm16-68h32v32H112Zm68,88a20,20,0,0,1-20-20V160h20a20,20,0,0,1,0,40Z" />
    </svg>
  )
}
