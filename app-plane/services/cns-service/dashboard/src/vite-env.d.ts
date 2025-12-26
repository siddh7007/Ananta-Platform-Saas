/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CNS_PORT?: string
  readonly VITE_CNS_DASHBOARD_PORT?: string
  readonly VITE_CNS_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
