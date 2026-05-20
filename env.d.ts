/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  // Boss thêm các biến khác vào đây nếu sau này có dùng thêm
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
