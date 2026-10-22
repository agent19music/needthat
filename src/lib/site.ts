export const siteName = '#needthat'

export const siteTitle = '#needthat — a visual wishlist'

export const siteDescription =
  'Sometimes, you just #needthat. A wishlist of all the stuff you wanna get.'

export const shareImage = {
  path: '/og.jpg',
  type: 'image/jpeg',
  width: '1024',
  height: '537',
  alt: 'Sometimes, you just #needthat. Make that wishlist.',
} as const

export const themeColor = {
  light: '#ffffff',
  dark: '#1d1d1d',
} as const

const themeBootstrap = `try{const saved=localStorage.getItem("theme");const dark=saved?saved==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=dark?"dark":"light";}catch{}`

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
  { rel: 'icon', href: '/icon-192.png', type: 'image/png', sizes: '192x192' },
  { rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' },
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
