// Vérification de format simple, côté client, pour un retour immédiat avant
// même d'appeler l'API (qui reste la source de vérité — voir AuthController.Register).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}
