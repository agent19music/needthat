'use client'

import { useEffect, useState } from 'react'

import UnderlineToBackground from '#/components/fancy/text/underline-to-background'

function useBackgroundColor() {
  const [color, setColor] = useState('#fff')

  useEffect(() => {
    const read = () => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--background)'
      document.body.append(probe)
      setColor(getComputedStyle(probe).color)
      probe.remove()
    }

    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return color
}

export function SiteFooter() {
  const hoverText = useBackgroundColor()

  return (
    <footer className="site-footer flex w-full justify-center">
      <p className="footer-credit">
        #needthat is a product of{' '}
        <a
          className="footer-raise"
          href="https://uzskicorp.agency"
          target="_blank"
          rel="noreferrer"
        >
          <UnderlineToBackground targetTextColor={hoverText}>
            Uzski Corp
          </UnderlineToBackground>
        </a>
      </p>
    </footer>
  )
}
