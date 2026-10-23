import { getRequestHeaders } from '@tanstack/react-start/server'

import { getAuth } from '#/lib/auth'

export async function readSession() {
  return getAuth().api.getSession({ headers: getRequestHeaders() })
}
