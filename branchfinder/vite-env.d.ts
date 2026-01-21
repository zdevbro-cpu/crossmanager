/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_API_URL: string
    readonly VITE_NAVER_GEOCODE_BASE_URL?: string
    readonly VITE_NAVER_MAP_CLIENT_ID: string
    readonly VITE_NAVER_MAP_CLIENT_SECRET: string
    readonly VITE_NAVER_SEARCH_CLIENT_ID?: string
    readonly VITE_NAVER_SEARCH_CLIENT_SECRET?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
