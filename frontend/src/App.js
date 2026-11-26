import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import AuthPage from "@/pages/AuthPage";
import ClassFeedPage from "@/pages/ClassFeedPage";
import LibraryPage from "@/pages/LibraryPage";
import DocumentPage from "@/pages/DocumentPage";
import AssistantPage from "@/pages/AssistantPage";
import TutoringPage from "@/pages/TutoringPage";
import WorkspacesPage from "@/pages/WorkspacesPage";
import WorkspacePage from "@/pages/WorkspacePage";
import ForumPage from "@/pages/ForumPage";
import ProfilePage from "@/pages/ProfilePage";
import MessagesPage from "@/pages/MessagesPage";
import ModerationPage from "@/pages/ModerationPage";
import { Loader2 } from "lucide-react";

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  return user ? children : <Navigate to="/connexion" replace />;
};

const PublicOnly = ({ children }) => {
  const { user } = useAuth();
  return user ? <Navigate to="/fil" replace /> : children;
};

const MyProfile = () => {
  const { user } = useAuth();
  return <Navigate to={`/profil/${user.id}`} replace />;
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/connexion"
              element={
                <PublicOnly>
                  <AuthPage />
                </PublicOnly>
              }
            />
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route
                path="/"
                element={<Navigate to="/fil" replace />}
              />
              <Route path="/fil" element={<ClassFeedPage />} />
              <Route path="/bibliotheque" element={<LibraryPage />} />
              <Route path="/fiche/:id" element={<DocumentPage />} />
              <Route path="/tutorat" element={<TutoringPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/espaces" element={<WorkspacesPage />} />
              <Route path="/espaces/:id" element={<WorkspacePage />} />
              <Route path="/forum" element={<ForumPage />} />
              <Route path="/profil" element={<MyProfile />} />
              <Route path="/profil/:id" element={<ProfilePage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/moderation" element={<ModerationPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
