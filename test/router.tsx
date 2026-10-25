import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'

/** Renders UI that uses <Link> inside a throwaway memory router. */
export function renderWithRouter(ui: () => ReactNode) {
  const rootRoute = createRootRoute({ component: () => <>{ui()}</> })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}
