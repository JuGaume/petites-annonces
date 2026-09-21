import { useEffect, useRef, useState } from 'react'

/**
 * Bascule à true la première fois que l'élément entre dans le viewport, puis se
 * déconnecte : sert à déclencher une apparition douce au scroll (une fois par carte).
 */
export function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '80px', threshold: 0.1 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}
