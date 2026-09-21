import { CaretLeft, CaretRight, X } from '@phosphor-icons/react'
import { useEffect } from 'react'

interface ImageLightboxProps {
  images: { id: number; url: string }[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

/**
 * Visionneuse plein écran des photos d'une annonce, ouverte au clic sur une photo dans
 * ListingDetailPage. Navigation clavier (flèches, Échap) en plus du clic, pour un usage
 * confortable au clavier sur desktop.
 */
export function ImageLightbox({ images, index, onClose, onNavigate }: ImageLightboxProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onNavigate((index + 1) % images.length)
      if (event.key === 'ArrowLeft') onNavigate((index - 1 + images.length) % images.length)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [index, images.length, onClose, onNavigate])

  const image = images[index]
  if (!image) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <X size={20} weight="bold" />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate((index - 1 + images.length) % images.length)
            }}
            aria-label="Photo précédente"
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white lg:left-6"
          >
            <CaretLeft size={22} weight="bold" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate((index + 1) % images.length)
            }}
            aria-label="Photo suivante"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white lg:right-6"
          >
            <CaretRight size={22} weight="bold" />
          </button>
        </>
      )}

      <img
        src={image.url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full object-contain"
      />

      {images.length > 1 && (
        <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-1.5">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: i === index ? '#ffffff' : 'rgba(255,255,255,0.4)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
