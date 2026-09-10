import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AdminRoute } from './components/AdminRoute'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AccountPage } from './pages/AccountPage'
import { AdminPage } from './pages/AdminPage'
import { ConversationsListPage } from './pages/ConversationsListPage'
import { ConversationThreadPage } from './pages/ConversationThreadPage'
import { CreateListingPage } from './pages/CreateListingPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { GroupDetailPage } from './pages/GroupDetailPage'
import { HomePage } from './pages/HomePage'
import { JoinGroupPage } from './pages/JoinGroupPage'
import { ListingDetailPage } from './pages/ListingDetailPage'
import { ListingsFeedPage } from './pages/ListingsFeedPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Accessible sans connexion : affiche l'invitation et propose de s'inscrire
              ou de se connecter avant de rejoindre le groupe automatiquement. */}
          <Route path="/join/:token" element={<JoinGroupPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups/:groupId"
            element={
              <ProtectedRoute>
                <GroupDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups/:groupId/listings"
            element={
              <ProtectedRoute>
                <ListingsFeedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups/:groupId/listings/new"
            element={
              <ProtectedRoute>
                <CreateListingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups/:groupId/listings/:listingId"
            element={
              <ProtectedRoute>
                <ListingDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <FavoritesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations"
            element={
              <ProtectedRoute>
                <ConversationsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations/:conversationId"
            element={
              <ProtectedRoute>
                <ConversationThreadPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
