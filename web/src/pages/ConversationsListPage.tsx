import { ChatCircle } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiJson, type ConversationResponse } from '../lib/apiClient'
import { ConversationThread } from '../components/ConversationThread'

// Mêmes teintes pastel que les avatars de groupe — repli pour l'initiale de l'interlocuteur.
const AVATAR_TINTS = [
  { bg: 'var(--tint-orange-bg)', text: 'var(--tint-orange-text)' },
  { bg: 'var(--tint-blue-bg)', text: 'var(--tint-blue-text)' },
  { bg: 'var(--tint-pink-bg)', text: 'var(--tint-pink-text)' },
  { bg: 'var(--tint-green-bg)', text: 'var(--tint-green-text)' },
  { bg: 'var(--tint-violet-bg)', text: 'var(--tint-violet-text)' },
  { bg: 'var(--tint-cyan-bg)', text: 'var(--tint-cyan-text)' },
]

function avatarTint(id: string) {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return AVATAR_TINTS[sum % AVATAR_TINTS.length]
}

const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

function formatConversationTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000)

  if (diffDays === 0) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Hier'
  if (diffDays > 1 && diffDays < 7) return WEEKDAYS[date.getDay()]
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/**
 * Sur mobile, une seule colonne à la fois (liste, ou fil si :conversationId est dans
 * l'URL). Sur desktop (lg+), une vraie vue « boîte de réception » : la liste reste
 * affichée dans une colonne fixe à gauche et le fil s'ouvre à droite sans la masquer —
 * les deux routes /conversations et /conversations/:conversationId pointent vers ce
 * même composant (voir App.tsx) pour partager cette mise en page.
 */
export function ConversationsListPage() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<ConversationResponse[]>('/conversations')
      .then(setConversations)
      .catch(() => setError('Impossible de charger vos conversations.'))
  }, [])

  const selectedId = conversationId ? Number(conversationId) : null
  const selectedConversation = selectedId ? conversations?.find((c) => c.id === selectedId) : undefined

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[var(--color-bg)] text-[var(--color-text)] lg:h-[calc(100vh-57px)] lg:min-h-0 lg:max-w-6xl lg:flex-row lg:border-l lg:border-r lg:border-[var(--color-border)]">
      {/* Colonne liste : plein écran sur mobile tant qu'aucune conversation n'est
          sélectionnée, colonne fixe à gauche sur desktop (toujours visible). */}
      <div
        className={`flex-col gap-4 overflow-y-auto px-4 py-6 lg:flex lg:w-[340px] lg:flex-none lg:border-r lg:border-[var(--color-border)] lg:px-5 ${
          selectedId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <Link to="/" className="text-sm text-[var(--color-text-muted)] lg:hidden">
          ← Mes groupes
        </Link>

        <h1 className="text-2xl font-bold tracking-tight lg:text-xl">Messages</h1>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {conversations && conversations.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Aucune conversation pour le moment. Contactez un vendeur depuis une annonce pour en démarrer une.
          </p>
        )}

        <ul className="flex flex-col">
          {conversations?.map((conversation) => {
            const isBuyer = conversation.buyerUserId === user?.id
            const otherPartyId = isBuyer ? conversation.sellerUserId : conversation.buyerUserId
            const otherPartyName = isBuyer ? conversation.sellerDisplayName : conversation.buyerDisplayName
            const lastMessageIsMine = conversation.lastMessageAuthorUserId === user?.id
            const tint = avatarTint(otherPartyId)
            const isActive = conversation.id === selectedId

            return (
              <li key={conversation.id} className="border-b border-[var(--color-border)] last:border-none">
                <Link
                  to={`/conversations/${conversation.id}`}
                  className={`flex items-center gap-3 py-3 lg:-mx-2 lg:rounded-xl lg:px-2 ${
                    isActive ? 'lg:bg-[var(--color-bg)]' : 'lg:hover:bg-[var(--color-bg)]'
                  }`}
                >
                  <div
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-base font-bold"
                    style={{ background: tint.bg, color: tint.text }}
                  >
                    {otherPartyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{otherPartyName}</span>
                      {conversation.lastMessageAt && (
                        <span className="flex-none text-xs text-[var(--color-text-faint)]">
                          {formatConversationTime(conversation.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[13px] text-[var(--color-text-muted)]">{conversation.listingTitle}</p>
                    {conversation.lastMessageContent && (
                      <p className="truncate text-[13px] font-medium">
                        {lastMessageIsMine ? 'Vous : ' : ''}
                        {conversation.lastMessageContent}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Volet droit : le fil sélectionné, plein écran sur mobile, à côté de la liste sur
          desktop — avec un état vide explicite tant qu'aucune conversation n'est ouverte. */}
      <div className={`flex-col lg:flex lg:flex-1 ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
        {selectedId ? (
          <ConversationThread conversationId={selectedId} conversation={selectedConversation} />
        ) : (
          <div className="hidden h-full flex-col items-center justify-center gap-2 px-8 text-center text-sm text-[var(--color-text-muted)] lg:flex">
            <ChatCircle size={40} weight="bold" color="var(--color-placeholder-icon)" />
            Sélectionnez une conversation pour l'ouvrir.
          </div>
        )}
      </div>
    </div>
  )
}
