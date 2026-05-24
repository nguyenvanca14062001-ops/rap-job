import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vitejs.dev/config/
export default defineConfig({
  /**
   * Custom domain rapjob.io → base phải là '/' để assets load đúng.
   * Nếu bỏ custom domain (dùng github.io/rap-job) thì đổi lại '/rap-job/'.
   */
  base: '/',

  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    // Tăng giới hạn cảnh báo dung lượng file nếu mày dùng nhiều ảnh/thư viện
    chunkSizeWarningLimit: 2000,
    outDir: 'dist',
    assetsDir: 'assets',
    // Làm sạch thư mục build mỗi lần chạy lại
    emptyOutDir: true,
  }
})