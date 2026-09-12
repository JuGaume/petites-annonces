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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8 md:max-w-xl">
      <Link to={`/groups/${groupId}/listings`} className="text-sm text-[var(--color-text-muted)]">
        ← Annonces du groupe
      </Link>

      <h1 className="text-2xl font-semibold">Déposer une annonce</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />

        <textarea
          placeholder="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-[var(--color-text-muted)]">Type d'annonce</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ListingMode)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          >
            <option value="Sale">Vente</option>
            <option value="Donation">Don</option>
            <option value="Trade">Troc</option>
          </select>
        </div>

        {mode === 'Sale' && (
          <input
            type="number"
            min={0}
            step="0.01"
            placeholder="Prix (€)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          />
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm text-[var(--color-text-muted)]">Contact</label>
          <select
            value={contactMode}
            onChange={(e) => setContactMode(e.target.value as ContactMode)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          >
            <option value="DirectContact">Afficher mes coordonnées</option>
            <option value="InternalMessaging">Messagerie interne (bientôt)</option>
          </select>
        </div>

        {contactMode === 'DirectContact' && (
          <input
            type="text"
            placeholder="Téléphone ou email de contact"
            value={contactDetails}
            onChange={(e) => setContactDetails(e.target.value)}
            required
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          />
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm text-[var(--color-text-muted)]">Photos (jusqu'à {MAX_IMAGES})</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImagesChange} />
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previews.map((url) => (
                <img key={url} src={url} alt="Aperçu" className="h-16 w-16 rounded object-cover" />
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-[var(--color-accent)] px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Publication...' : "Publier l'annonce"}
        </button>
      </form>
    </main>
  )
}
