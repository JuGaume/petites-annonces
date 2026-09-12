import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { HubConnection } from '@microsoft/signalr'
import { useAuth } from '../auth/AuthContext'
import { apiJson, ApiError, type ConversationResponse, type MessageResponse } from '../lib/apiClient'
import { connectToConversation } from '../lib/conversationsHub'

// Mêmes teintes pastel que les avatars de groupe/conversations.
const AVATAR_TINTS = [
  { bg: '#FDE7D3', text: '#C2410C' },
  { bg: '#DBEAFE', text: '#2563EB' },
  { bg: '#FCE7F3', text: '#BE185C' },
  { bg: '#DCFCE7', text: '#15803D' },
  { bg: '#EDE9FE', text: '#6D28D9' },
  { bg: '#CFFAFE', text: '#0E7490' },
]

function avatarTint(id: string) {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return AVATAR_TINTS[sum % AVATAR_TINTS.length]
}

/**
 * Le fil d'une conversation — extrait de l'ancienne ConversationThreadPage pour être
 * réutilisé à la fois en plein écran (mobile, une conversation à la fois) et dans le
 * volet droit d'une vue « boîte de réception » à deux colonnes (desktop, liste + fil
 * côte à côte). Reçoit la conversation déjà chargée par le parent (ConversationsListPage)
 * plutôt que de la refetcher, pour ne pas dupliquer l'appel /conversations.
 */
export function ConversationThread({
  conversationId,
  conversation,
}: {
  conversationId: number
  conversation: ConversationResponse | undefined
}) {
  const { user } = useAuth()

  const [messages, setMessages] = useState<MessageResponse[]>([])
  const [draft, setDraft] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const seenMessageIds = useRef(new Set<number>())

  function appendMessage(message: MessageResponse) {
    if (seenMessageIds.current.has(message.id)) {
      return
    }
    seenMessageIds.current.add(message.id)
    setMessages((current) => [...current, message])
  }

  useEffect(() => {
    seenMessageIds.current = new Set()
    setMessages([])
    setLoadError(null)

    apiJson<MessageResponse[]>(`/conversations/${conversationId}/messages`)
      .then((history) => {
        history.forEach((message) => seenMessageIds.current.add(message.id))
        setMessages(history)
      })
      .catch(() => setLoadError('Impossible de charger cette conversation.'))

    let connection: HubConnection | undefined
    connectToConversation(conversationId, appendMessage)
      .then((c) => {
        connection = c
      })
      .catch(() => setLoadError('Connexion temps réel indisponible — les messages resteront visibles après rechargement.'))

    return () => {
      connection?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim()) {
      return
    }

    setSendError(null)
    setIsSending(true)
    try {
      const message = await apiJson<MessageResponse>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: draft.trim() }),
      })
      appendMessage(message)
      setDraft('')
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Impossible d'envoyer le message.")
    } finally {
      setIsSending(false)
    }
  }

  const otherPartyId = conversation
    ? conversation.buyerUserId === user?.id
      ? conversation.sellerUserId
      : conversation.buyerUserId
    : null
  const otherPartyName = conversation
    ? conversation.buyerUserId === user?.id
      ? conversation.sellerDisplayName
      : conversation.buyerDisplayName
    : null
  const tint = otherPartyId ? avatarTint(otherPartyId) : AVATAR_TINTS[0]

  return (
    <div className="flex h-full min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)] lg:min-h-0">
      <div className="flex flex-none items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
        <Link to="/conversations" aria-label="Messages" className="flex-none lg:hidden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold"
          style={{ background: tint.bg, color: tint.text }}
        >
          {otherPartyName?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold">{otherPartyName ?? 'Conversation'}</h1>
          {conversation && <p className="truncate text-xs text-[var(--color-text-muted)]">{conversation.listingTitle}</p>}
        </div>
      </div>

      {loadError && <p className="px-4 pt-2 text-sm text-red-600">{loadError}</p>}

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        {messages.map((message) => {
          const isMine = message.authorUserId === user?.id
          return (
            <div
              key={message.id}
              className={
                isMine
                  ? 'max-w-[78%] self-end rounded-[14px_14px_4px_14px] bg-[var(--color-gold)] px-3.5 py-2.5 text-sm leading-snug text-[var(--color-accent)]'
                  : 'max-w-[78%] self-start rounded-[14px_14px_14px_4px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm leading-snug'
              }
            >
              {message.content}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && <p className="px-4 pb-2 text-sm text-red-600">{sendError}</p>}

      <form onSubmit={handleSubmit} className="flex flex-none items-center gap-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 pb-6 lg:pb-3">
        <input
          type="text"
          placeholder="Écrire un message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm placeholder:text-[#9ca3af]"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          aria-label="Envoyer"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--color-gold)] disabled:opacity-60"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
    </div>
  )
}
