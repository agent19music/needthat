export const siteName = '#needthat'

export const siteTitle = '#needthat — a visual wishlist'

export const siteDescription =
  'Sometimes, you just #needthat. A wishlist of all the stuff you wanna get.'

export const shareImage = {
  path: '/og.jpg',
  type: 'image/jpeg',
  width: '1200',
  height: '630',
  alt: 'Sometimes, you just #needthat. Make that wishlist.',
} as const

export const twitterSite = '@uzskicorp'

export const themeColor = {
  light: '#ffffff',
  dark: '#1d1d1d',
} as const

const themeBootstrap = `document.documentElement.dataset.theme="light";`

const themeColorBootstrap = `try{const dark=document.documentElement.dataset.theme==="dark";const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",dark?"${themeColor.dark}":"${themeColor.light}");}catch{}`

export const themeScript = themeBootstrap

export const themeColorScript = themeColorBootstrap

export function paintTheme(next: 'light' | 'dark') {
  document.documentElement.dataset.theme = next
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeColor[next])
}

export const logo = {
  path: '/needthat-logo.webp',
  type: 'image/webp',
  width: 1684,
  height: 2528,
} as const

export const iconLinks = [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  {
    rel: 'icon',
    href: '/favicon-32x32.png',
    type: 'image/png',
    sizes: '32x32',
  },
  { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
  { rel: 'icon', href: '/icon-192.png', type: 'image/png', sizes: '192x192' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
  { rel: 'manifest', href: '/manifest.webmanifest' },
]

export async function siteOrigin() {
  const configured = import.meta.env.VITE_SITE_URL
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim().replace(/\/$/, '')
  }
  if (!import.meta.env.SSR) return window.location.origin
  try {
    const { getRequestUrl } = await import('@tanstack/react-start/server')
    return getRequestUrl().origin
  } catch {
    return ''
  }
}

export function publicListHead(
  origin: string,
  profile: {
    username: string
    name: string
    imageVersion: string
    items: Array<unknown>
  },
) {
  const path = `/u/${profile.username}`
  const url = origin ? `${origin}${path}` : undefined
  const title = `${profile.name} on #needthat`
  const count = profile.items.length
  const description =
    count === 0
      ? `${profile.name} has not added a wish yet.`
      : `${profile.name} has ${count} ${count === 1 ? 'wish' : 'wishes'} on #needthat.`
  const dynamic = Boolean(origin) && count > 0
  const image = origin
    ? dynamic
      ? `${origin}/api/og/u/${profile.username}?v=${profile.imageVersion}`
      : `${origin}${shareImage.path}`
    : undefined
  const imageType = dynamic ? 'image/png' : shareImage.type
  const index = count > 0

  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'robots', content: index ? 'index, follow' : 'noindex' },
      { property: 'og:site_name', content: siteName },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      ...(url ? [{ property: 'og:url', content: url }] : []),
      ...(image
        ? [
            { property: 'og:image', content: image },
            {
              property: 'og:image:alt',
              content: `${profile.name}'s wishlist on #needthat`,
            },
            { property: 'og:image:type', content: imageType },
            { property: 'og:image:width', content: shareImage.width },
            { property: 'og:image:height', content: shareImage.height },
          ]
        : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: twitterSite },
      ...(url ? [{ name: 'twitter:url', content: url }] : []),
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      ...(image
        ? [
            { name: 'twitter:image', content: image },
            {
              name: 'twitter:image:alt',
              content: `${profile.name}'s wishlist on #needthat`,
            },
          ]
        : []),
    ],
    links: [...(url ? [{ rel: 'canonical', href: url }] : [])],
  }
}

export function homeHead(origin: string) {
  const url = origin ? `${origin}/` : undefined
  const image = origin ? `${origin}${shareImage.path}` : undefined
  const logoUrl = origin ? `${origin}${logo.path}` : undefined
  const logoMeta = logoUrl
    ? {
        logo: {
          '@type': 'ImageObject',
          url: logoUrl,
          width: logo.width,
          height: logo.height,
        },
      }
    : {}

  return {
    meta: [
      { title: siteTitle },
      { name: 'description', content: siteDescription },
      { name: 'application-name', content: siteName },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:site_name', content: siteName },
      { property: 'og:title', content: siteTitle },
      { property: 'og:description', content: siteDescription },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'en' },
      ...(url ? [{ property: 'og:url', content: url }] : []),
      ...(image
        ? [
            { property: 'og:image', content: image },
            { property: 'og:image:alt', content: shareImage.alt },
            { property: 'og:image:type', content: shareImage.type },
            { property: 'og:image:width', content: shareImage.width },
            { property: 'og:image:height', content: shareImage.height },
          ]
        : []),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: twitterSite },
      ...(url ? [{ name: 'twitter:url', content: url }] : []),
      { name: 'twitter:title', content: siteTitle },
      { name: 'twitter:description', content: siteDescription },
      ...(image
        ? [
            { name: 'twitter:image', content: image },
            { name: 'twitter:image:alt', content: shareImage.alt },
          ]
        : []),
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              name: siteName,
              description: siteDescription,
              ...(url ? { url } : {}),
              ...(image ? { image } : {}),
              ...logoMeta,
            },
            {
              '@type': 'WebApplication',
              name: siteName,
              description: siteDescription,
              applicationCategory: 'LifestyleApplication',
              operatingSystem: 'Web',
              ...(url ? { url } : {}),
              ...(image ? { image } : {}),
              ...logoMeta,
            },
          ],
        },
      },
    ],
    links: [...(url ? [{ rel: 'canonical', href: url }] : [])],
  }
}
