import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '../pages/LandingPage/LandingPage';
import LoginPage from '../pages/LoginPage/LoginPage';
import RegisterPage from '../pages/RegisterPage/RegisterPage';
import ArticleListPage from '../pages/ArticleListPage/ArticleListPage';
import ArticleDetailPage from '../pages/ArticleDetailPage/ArticleDetailPage';
import ProcessingProgressPage from '../pages/ProcessingProgressPage/ProcessingProgressPage';
import ProfilePage from '../pages/ProfilePage/ProfilePage';
import AdminPage from '../pages/AdminPage/AdminPage';
import OlapSchemasPage from '../pages/OlapSchemasPage/OlapSchemasPage';
import HelpPage from '../pages/HelpPage/HelpPage';
import { RequireAdmin, RequireConnection, RequireLogin, RequireProcessed } from './guards';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <RequireLogin>
            <LandingPage />
          </RequireLogin>
        }
      />
      <Route
        path="/processing-progress"
        element={
          <RequireLogin>
            <RequireConnection>
              <ProcessingProgressPage />
            </RequireConnection>
          </RequireLogin>
        }
      />
      <Route
        path="/news"
        element={
          <RequireLogin>
            <RequireConnection>
              <RequireProcessed>
                <ArticleListPage />
              </RequireProcessed>
            </RequireConnection>
          </RequireLogin>
        }
      />
      <Route
        path="/olap-schemas"
        element={
          <RequireLogin>
            <RequireConnection>
              <RequireProcessed>
                <OlapSchemasPage />
              </RequireProcessed>
            </RequireConnection>
          </RequireLogin>
        }
      />
      <Route
        path="/article/:id"
        element={
          <RequireLogin>
            <RequireConnection>
              <ArticleDetailPage />
            </RequireConnection>
          </RequireLogin>
        }
      />
      <Route
        path="/help"
        element={
          <RequireLogin>
            <HelpPage />
          </RequireLogin>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireLogin>
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          </RequireLogin>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireLogin>
            <ProfilePage />
          </RequireLogin>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
