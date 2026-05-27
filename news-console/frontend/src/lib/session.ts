export const CONNECTION_KEY = 'nc_connected';
export const LOGIN_KEY = 'nc_token';
export const LOGIN_NAME_KEY = 'nc_user';
export const LOGIN_EMAIL_KEY = 'nc_email';
export const LOGIN_ROLE_KEY = 'nc_role';
export const PROCESSED_KEY = 'nc_processed';
export const MONGO_URI_KEY = 'nc_mongo_uri';
export const ADMIN_ROLE = 'Admin';

export function getAuthToken(): string {
  return sessionStorage.getItem(LOGIN_KEY) || localStorage.getItem(LOGIN_KEY) || '';
}
