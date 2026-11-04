/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth client ID from Google Cloud Console; the backend's GOOGLE_CLIENT_ID must be the same. */
  readonly VITE_GOOGLE_CLIENT_ID: string
}
