import { BrowserRouter, useLocation } from 'react-router-dom';
import Header from './components/Header/Header';
import AppRoutes from './routes/AppRoutes';

export {
  CONNECTION_KEY,
  LOGIN_KEY,
  LOGIN_NAME_KEY,
  LOGIN_EMAIL_KEY,
  LOGIN_ROLE_KEY,
  PROCESSED_KEY,
  MONGO_URI_KEY,
  ADMIN_ROLE,
} from './lib/session';

function Layout() {
  const { pathname } = useLocation();
  const hideHeader = pathname === '/login' || pathname === '/register';

  return (
    <>
      {!hideHeader && <Header />}
      <AppRoutes />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
