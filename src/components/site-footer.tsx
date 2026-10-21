'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

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

const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, staggerChildren: 0.1 },
  },
}

const wordVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const words = 'Weekly goodies delivered straight to your inbox —'.split(' ')

export function SiteFooter() {
  const hoverText = useBackgroundColor()

  return (
    <footer className="site-footer flex w-full justify-center">
      <motion.h2
        className="max-w-3xl px-12 py-12 text-center text-xl md:px-24 md:py-24"
        initial="hidden"
        animate="visible"
        variants={fadeInVariants}
      >
        {words.map((word, index) => (
          <motion.span
            key={index}
            variants={wordVariants}
            className="mr-1 inline-block"
          >
            {word}
          </motion.span>
        ))}
        <motion.span variants={wordVariants} className="inline-block">
          <UnderlineToBackground targetTextColor={hoverText} className="cursor-pointer">
            subscribe
          </UnderlineToBackground>
        </motion.span>
      </motion.h2>
    </footer>
  )
}
