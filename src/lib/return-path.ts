/** Only a public sheet ("Sign in to claim") can be a return URL. */
export function returnPath(value: unknown) {
  if (typeof value !== 'string') return null
  return /^\/u\/[a-z0-9_]{3,30}(\?sheet=[A-Za-z0-9-]{1,64})?$/.test(value)
    ? value
    : null
}
