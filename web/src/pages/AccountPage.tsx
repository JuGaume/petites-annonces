import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  apiFetch,
  apiJson,
  ApiError,
  extractErrorMessage,
  type AccountResponse,
} from '../lib/apiClient'

export function AccountPage() {
  const { refreshUser } = useAuth()

  const [account, setAccount] = useState<AccountResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileNotice, setProfileNotice] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [photoError, setPhotoError] = useState<string | null>(null)
  const [isSavingPhoto, setIsSavingPhoto] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailNotice, setEmailNotice] = useState<string | null>(null)
  const [isSavingEmail, setIsSavingEmail] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  function applyAccount(next: AccountResponse) {
    setAccount(next)
    setDisplayName(next.displayName)
    setPhoneNumber(next.phoneNumber ?? '')
  }

  useEffect(() => {
    apiJson<AccountResponse>('/account')
      .then(applyAccount)
      .catch(() => setLoadError('Impossible de charger votre profil.'))
  }, [])

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault()
    setProfileError(null)
    setProfileNotice(null)
    setIsSavingProfile(true)
    try {
      const updated = await apiJson<AccountResponse>('/account', {
        method: 'PUT',
        body: JSON.stringify({ displayName: displayName.trim(), phoneNumber: phoneNumber.trim() || null }),
      })
      applyAccount(updated)
      setProfileNotice('Profil mis à jour.')
      await refreshUser()
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Impossible de mettre à jour le profil.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setPhotoError(null)
    setIsSavingPhoto(true)
    try {
      const form = new FormData()
      form.set('photo', file)
      const response = await apiFetch('/account/photo', { method: 'POST', body: form })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new ApiError(response.status, extractErrorMessage(body, 'Impossible de mettre à jour la photo.'))
      }
      applyAccount(await response.json())
      await refreshUser()
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Impossible de mettre à jour la photo.')
    } finally {
      setIsSavingPhoto(false)
    }
  }

  async function handleDeletePhoto() {
    setPhotoError(null)
    setIsSavingPhoto(true)
    try {
      await apiJson('/account/photo', { method: 'DELETE' })
      setAccount((current) => (current ? { ...current, photoUrl: null } : current))
      await refreshUser()
    } catch (err) {
      setPhotoError(err instanceof ApiError ? err.message : 'Impossible de supprimer la photo.')
    } finally {
      setIsSavingPhoto(false)
    }
  }

  async function handleChangeEmail(event: FormEvent) {
    event.preventDefault()
    setEmailError(null)
    setEmailNotice(null)
    setIsSavingEmail(true)
    try {
      const updated = await apiJson<AccountResponse>('/account/change-email', {
        method: 'POST',
        body: JSON.stringify({ newEmail: newEmail.trim(), currentPassword: emailPassword }),
      })
      applyAccount(updated)
      setNewEmail('')
      setEmailPassword('')
      setEmailNotice('Adresse email mise à jour.')
      await refreshUser()
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : "Impossible de changer l'adresse email.")
    } finally {
      setIsSavingEmail(false)
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault()
    setPasswordError(null)
    setPasswordNotice(null)
    setIsSavingPassword(true)
    try {
      await apiJson('/account/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setPasswordNotice('Mot de passe mis à jour.')
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Impossible de changer le mot de passe.')
    } finally {
      setIsSavingPassword(false)
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-red-600">{loadError}</p>
        <Link to="/" className="text-sm font-medium text-[var(--color-accent)]">
          Retour à mes groupes
        </Link>
      </main>
    )
  }

  if (!account) {
    return <p className="p-4 text-center text-[var(--color-text-muted)]">Chargement...</p>
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-8 md:max-w-3xl md:px-8">
      <Link to="/" className="text-sm text-[var(--color-text-muted)]">
        ← Mes groupes
      </Link>

      <h1 className="text-2xl font-semibold">Mon compte</h1>

      {/* Deux colonnes à partir de lg (profil à gauche, identifiants à droite) plutôt
          qu'une longue colonne unique de formulaires empilés (voir feedback desktop). */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-6">
        <section className="flex flex-col items-center gap-3">
          <div className="h-24 w-24 overflow-hidden rounded-full bg-[var(--color-bg)]">
            {account.photoUrl && (
              <img src={account.photoUrl} alt={account.displayName} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer rounded border border-[var(--color-border)] px-3 py-2 text-sm">
              {isSavingPhoto ? 'Envoi...' : 'Changer la photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                disabled={isSavingPhoto}
                className="hidden"
              />
            </label>
            {account.photoUrl && (
              <button
                onClick={handleDeletePhoto}
                disabled={isSavingPhoto}
                className="rounded border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-60"
              >
                Retirer
              </button>
            )}
          </div>
          {photoError && <p className="text-sm text-red-600">{photoError}</p>}
        </section>

        <form
          onSubmit={handleChangeEmail}
          className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-6 lg:row-span-2 lg:border-t-0 lg:pt-0"
        >
          <h2 className="font-semibold">Adresse email</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Actuelle : {account.email}</p>
          <input
            type="email"
            placeholder="Nouvelle adresse email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          />
          <input
            type="password"
            placeholder="Mot de passe actuel"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            required
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          />
          {emailError && <p className="text-sm text-red-600">{emailError}</p>}
          {emailNotice && <p className="text-sm text-[var(--color-accent)]">{emailNotice}</p>}
          <button
            type="submit"
            disabled={isSavingEmail}
            className="self-start rounded border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-60"
          >
            {isSavingEmail ? 'Enregistrement...' : "Changer l'email"}
          </button>
        </form>

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-6 lg:border-t-0 lg:pt-0">
          <h2 className="font-semibold">Profil</h2>
          <input
            type="text"
            placeholder="Nom affiché"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          />
          <input
            type="tel"
            placeholder="Téléphone (optionnel)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          />
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          {profileNotice && <p className="text-sm text-[var(--color-accent)]">{profileNotice}</p>}
          <button
            type="submit"
            disabled={isSavingProfile}
            className="self-start rounded bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSavingProfile ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>

        <form onSubmit={handleChangePassword} className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-6">
          <h2 className="font-semibold">Mot de passe</h2>
          <input
            type="password"
            placeholder="Mot de passe actuel"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          />
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          />
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordNotice && <p className="text-sm text-[var(--color-accent)]">{passwordNotice}</p>}
          <button
            type="submit"
            disabled={isSavingPassword}
            className="self-start rounded border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-60"
          >
            {isSavingPassword ? 'Enregistrement...' : 'Changer le mot de passe'}
          </button>
        </form>
      </div>
    </main>
  )
}
