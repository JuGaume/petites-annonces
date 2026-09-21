import { Camera, X } from '@phosphor-icons/react'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  apiFetch,
  apiJson,
  ApiError,
  extractErrorMessage,
  type CategoryResponse,
  type ContactMode,
  type ListingDetailResponse,
  type ListingMode,
} from '../lib/apiClient'

const MAX_IMAGES = 8

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-[#374151]">{label}</label>
      {children}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-[var(--radius-pill)] border border-[var(--color-border)]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            option.value === value
              ? 'flex-1 bg-[var(--color-accent)] px-2 py-2 text-[13px] font-semibold text-white'
              : 'flex-1 px-2 py-2 text-[13px] font-medium text-[var(--color-text-muted)]'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const inputClass =
  'rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[15px] placeholder:text-[var(--color-text-faint)]'

export function CreateListingPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<ListingMode>('Sale')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [contactMode, setContactMode] = useState<ContactMode>('DirectContact')
  const [contactDetails, setContactDetails] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    apiJson<CategoryResponse[]>('/categories')
      .then((result) => {
        setCategories(result)
        if (result.length > 0) {
          setCategoryId(String(result[0].id))
        }
      })
      .catch(() => setError('Impossible de charger les catégories.'))
  }, [])

  // Nettoie les URLs objet créées pour l'aperçu des photos à chaque changement/démontage.
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url))
  }, [previews])

  function handleImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []).slice(0, MAX_IMAGES)
    setImages(selected)
    setPreviews(selected.map((file) => URL.createObjectURL(file)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!groupId || !title.trim() || !categoryId) {
      setError('Merci de renseigner au moins le titre et la catégorie.')
      return
    }

    const form = new FormData()
    form.set('Title', title.trim())
    if (description.trim()) form.set('Description', description.trim())
    form.set('Mode', mode)
    form.set('CategoryId', categoryId)
    form.set('ContactMode', contactMode)
    if (mode === 'Sale' && price) form.set('Price', price)
    if (contactMode === 'DirectContact' && contactDetails.trim()) {
      form.set('ContactDetails', contactDetails.trim())
    }
    images.forEach((file) => form.append('Images', file))

    setIsSubmitting(true)
    try {
      const response = await apiFetch(`/groups/${groupId}/listings`, { method: 'POST', body: form })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new ApiError(response.status, extractErrorMessage(body, 'Impossible de créer cette annonce.'))
      }
      const listing: ListingDetailResponse = await response.json()
      navigate(`/groups/${groupId}/listings/${listing.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer cette annonce.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 bg-[var(--color-bg)] px-4 py-6 text-[var(--color-text)] lg:max-w-3xl lg:px-8 lg:py-10">
      <div className="flex items-center justify-between">
        <Link
          to={`/groups/${groupId}/listings`}
          aria-label="Annuler"
          className="flex h-8 w-8 items-center justify-center"
        >
          <X size={20} weight="bold" />
        </Link>
        <h1 className="text-[15px] font-semibold lg:text-xl">Nouvelle annonce</h1>
        <div className="w-8" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 lg:gap-6 lg:rounded-2xl lg:border lg:border-[var(--color-border)] lg:bg-[var(--color-surface)] lg:p-8"
      >
        {/* Desktop : deux colonnes (photos/titre/description à gauche, catégorie et
            réglages à droite) plutôt qu'un long formulaire empilé sur toute la largeur. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-5">
          <div className="flex flex-col gap-4">
            <Field label={`Photos (jusqu'à ${MAX_IMAGES})`}>
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[var(--color-placeholder-icon)] bg-[var(--color-surface)] lg:h-32 lg:bg-[var(--color-bg)]">
                <Camera size={24} weight="bold" color="var(--color-text-faint)" />
                <span className="text-[13px] text-[var(--color-text-muted)]">Ajouter des photos</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImagesChange}
                  className="hidden"
                />
              </label>
              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {previews.map((url) => (
                    <img key={url} src={url} alt="Aperçu" className="h-16 w-16 rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </Field>

            <Field label="Titre">
              <input
                type="text"
                placeholder="Ex : Vélo enfant 16 pouces"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Description">
              <textarea
                placeholder="État, dimensions, lieu de retrait..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none lg:flex-1`}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-4">
            <Field label="Catégorie">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className={inputClass}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Cette annonce est pour">
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'Sale', label: 'Vente' },
                  { value: 'Donation', label: 'Don' },
                  { value: 'Trade', label: 'Troc' },
                ]}
              />
            </Field>

            {mode === 'Sale' && (
              <Field label="Prix">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="25 €"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className={inputClass}
                />
              </Field>
            )}

            <Field label="Mode de contact">
              <Segmented
                value={contactMode}
                onChange={setContactMode}
                options={[
                  { value: 'InternalMessaging', label: 'Messagerie interne' },
                  { value: 'DirectContact', label: 'Coordonnées directes' },
                ]}
              />
            </Field>

            {contactMode === 'DirectContact' && (
              <input
                type="text"
                placeholder="Téléphone ou email de contact"
                value={contactDetails}
                onChange={(e) => setContactDetails(e.target.value)}
                required
                className={inputClass}
              />
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-[var(--radius-pill)] bg-[var(--color-gold)] px-3 py-3.5 text-[15px] font-bold text-[var(--color-accent)] disabled:opacity-60 lg:self-end lg:px-8"
        >
          {isSubmitting ? 'Publication...' : "Publier l'annonce"}
        </button>
      </form>
    </main>
  )
}
