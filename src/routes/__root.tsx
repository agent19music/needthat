import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import arcCss from '@/components/arc/foundation.css?url'
import appCss from '../styles.css?url'

import { AccountMenu } from '#/components/account-menu'
import { SiteFooter } from '#/components/site-footer'

const themeScript = `try {const saved = localStorage.getItem("theme");const dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme = dark ? "dark" : "light";} catch {}`

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
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: '#needthat',
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
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        <AccountMenu />
        <div className="flex min-h-dvh flex-col">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
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
        <Scripts />
      </body>
    </html>
  )
}
