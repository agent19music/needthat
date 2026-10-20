import { createFileRoute } from '@tanstack/react-router'

import { ListPrototype } from '#/prototypes/list/harness'

export const Route = createFileRoute('/prototypes/list')({
  component: ListPrototype,
})
