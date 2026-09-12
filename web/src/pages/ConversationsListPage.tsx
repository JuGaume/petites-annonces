import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiJson, type ConversationResponse } from '../lib/apiClient'

export function ConversationsListPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiJson<ConversationResponse[]>('/conversations')
      .then(setConversations)
      .catch(() => setError('Impossible de charger vos conversations.'))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8 md:max-w-2xl">
      <Link to="/" className="text-sm text-[var(--color-text-muted)]">
        ← Mes groupes
      </Link>

      <h1 className="text-2xl font-semibold">Messages</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {conversations && conversations.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Aucune conversation pour le moment. Contactez un vendeur depuis une annonce pour en démarrer une.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {conversations?.map((conversation) => {
          const isBuyer = conversation.buyerUserId === user?.id
          const otherPartyName = isBuyer ? conversation.sellerDisplayName : conversation.buyerDisplayName
          const lastMessageIsMine = conversation.lastMessageAuthorUserId === user?.id

          return (
            <li key={conversation.id}>
              <Link
                to={`/conversations/${conversation.id}`}
                className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
              >
                <div className="h-12 w-12 flex-none overflow-hidden rounded bg-[var(--color-bg)]">
                  {conversation.listingThumbnailUrl && (
                    <img
                      src={conversation.listingThumbnailUrl}
                      alt={conversation.listingTitle}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{conversation.listingTitle}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    {otherPartyName}
                    {conversation.lastMessageContent && (
                      <>
                        {' · '}
                        {lastMessageIsMine ? 'Vous : ' : ''}
                        {conversation.lastMessageContent}
                      </>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
