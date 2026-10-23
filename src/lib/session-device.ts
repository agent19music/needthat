import type { ActiveSessionDevice } from '#/components/block/active-sessions'

export function describeClient(userAgent: string | null | undefined): {
  device: ActiveSessionDevice
  browser?: string
  os?: string
} {
  const agent = userAgent ?? ''
  const tablet = /iPad|Tablet/i.test(agent)
  const phone = /iPhone|Android.+Mobile|Mobile/i.test(agent)
  let browser: string | undefined
  if (/Edg\//.test(agent)) browser = 'Edge'
  else if (/Firefox\//.test(agent)) browser = 'Firefox'
  else if (/Chrome\//.test(agent)) browser = 'Chrome'
  else if (/Safari\//.test(agent)) browser = 'Safari'
  let os: string | undefined
  if (/iPhone|iPad/.test(agent)) os = 'iOS'
  else if (/Android/.test(agent)) os = 'Android'
  else if (/Mac OS X/.test(agent)) os = 'macOS'
  else if (/Windows/.test(agent)) os = 'Windows'
  else if (/Linux/.test(agent)) os = 'Linux'
  return {
    device: tablet ? 'tablet' : phone ? 'phone' : 'laptop',
    browser,
    os,
  }
}
