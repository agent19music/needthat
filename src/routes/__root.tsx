import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import arcCss from '@/components/arc/foundation.css?url'
import appCss from '../styles.css?url'

import { AccountMenu } from '#/components/account-menu'
import { SiteFooter } from '#/components/site-footer'
import {
  iconLinks,
  siteName,
  themeColor,
  themeColorScript,
  themeScript,
} from '#/lib/site'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
      },
      {
        title: siteName,
      },
      {
        name: 'theme-color',
        content: themeColor.light,
      },
      {
        name: 'color-scheme',
        content: 'light',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: arcCss,
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
      ...iconLinks,
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeColorScript }} />
      </head>
      <body>
        <AccountMenu />
        <div className="flex min-h-dvh flex-col">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
        <DevPanels />
        <Scripts />
      </body>
    </html>
  )
}

/** Dev only, and off for screenshot runs (`?shots`) so it never covers the UI. */
function DevPanels() {
  const [shots, setShots] = useState(true)
  useEffect(() => {
    setShots(
      new URLSearchParams(window.location.search).has('shots') ||
        sessionStorage.getItem('nt-shots') === '1',
    )
    if (new URLSearchParams(window.location.search).has('shots'))
      sessionStorage.setItem('nt-shots', '1')
  }, [])
  if (!import.meta.env.DEV || shots) return null
  return (
    <TanStackDevtools
      config={{
        position: 'bottom-right',
      }}
      plugins={[
        {
          name: 'Tanstack Router',
          render: <TanStackRouterDevtoolsPanel />,
        },
        TanStackQueryDevtools,
      ]}
    />
  )
}
