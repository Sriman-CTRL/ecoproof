/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base URL for the deployed web (the Render URL). Unset in dev: the Vite proxy serves /api. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
