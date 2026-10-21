import { createFileRoute } from '@tanstack/react-router'

import { StampPrototype } from '#/prototypes/stamps/harness'

export const Route = createFileRoute('/prototypes/stamps')({
  component: StampPrototype,
})
