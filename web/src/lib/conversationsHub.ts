import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { API_BASE_URL, getAccessToken, type MessageResponse } from './apiClient'

/**
 * Ouvre une connexion SignalR vers ConversationsHub et rejoint le groupe du fil de
 * discussion, pour recevoir les nouveaux messages en temps réel (l'historique reste
 * chargé via l'API REST — voir ConversationThreadPage).
 */
export async function connectToConversation(
  conversationId: number,
  onMessage: (message: MessageResponse) => void,
): Promise<HubConnection> {
  const connection = new HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/conversations`, {
      accessTokenFactory: () => getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()

  connection.on('ReceiveMessage', onMessage)
  // Après une reconnexion (perte réseau...), il faut rejoindre le groupe à nouveau.
  connection.onreconnected(() => {
    connection.invoke('JoinConversation', conversationId).catch(() => undefined)
  })

  await connection.start()
  await connection.invoke('JoinConversation', conversationId)

  return connection
}
