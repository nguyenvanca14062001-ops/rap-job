<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

type Platform = 'android' | 'ios' | 'other'

const isInApp = ref(false)
const dismissed = ref(false)
const platform = ref<Platform>('other')
const isCopied = ref(false)
const androidIntentFailed = ref(false)

let intentTimer: number | undefined
let visibilityHandler: (() => void) | null = null

onMounted(() => {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera

  // Danh sách nhận diện trình duyệt nhúng trong app (Messenger, Facebook, Zalo, Threads, Instagram, ...)
  const rules = [
    'FBAN', 'FBAV', 'FBIOS', // Facebook, Messenger
    'Zalo', // Zalo
    'Instagram', // Instagram
    'Threads', 'Barcelona', // Threads (kể cả tên mã ẩn)
    'TikTok', 'trill', 'ByteLocale', // TikTok
    'Messenger', 'Line', 'Viber', // App chat khác
    'wv', 'WebView' // Trình duyệt nhúng (WebView) chung trên Android
  ]
  const isBadBrowser = rules.some(rule => new RegExp(rule, 'i').test(ua))

  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isSafari = /Safari/i.test(ua)
  // Trên iOS, mọi trình duyệt hợp lệ (Safari, Chrome, Firefox...) đều bắt buộc dùng WebKit nên UA luôn có "Safari".
  // Nếu là iOS mà UA không có "Safari" thì gần như chắc chắn là WebView ẩn trong app.
  const isIOSWebview = isIOS && !isSafari

  if (isBadBrowser || isIOSWebview) {
    isInApp.value = true
    platform.value = isAndroid ? 'android' : isIOS ? 'ios' : 'other'
  }
})

onUnmounted(() => {
  if (intentTimer) window.clearTimeout(intentTimer)
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
})

// Mở trực tiếp website hiện tại bằng Chrome trên Android qua Android Intent, dựng từ URL hiện tại (không hard-code domain)
const tryOpenChrome = () => {
  androidIntentFailed.value = false

  try {
    const scheme = window.location.protocol.replace(':', '')
    const urlWithoutScheme = window.location.href.replace(/^https?:\/\//i, '')
    const intentUrl = `intent://${urlWithoutScheme}#Intent;scheme=${scheme};package=com.android.chrome;end`

    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = () => {
      if (document.hidden && intentTimer) {
        window.clearTimeout(intentTimer)
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    intentTimer = window.setTimeout(() => {
      if (!document.hidden) {
        androidIntentFailed.value = true
      }
    }, 1800)

    window.location.href = intentUrl
  } catch (err) {
    androidIntentFailed.value = true
  }
}

const showCopiedState = () => {
  isCopied.value = true
  setTimeout(() => { isCopied.value = false }, 2000)
}

const copyLink = async () => {
  const text = window.location.href

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      showCopiedState()
      return
    }
    throw new Error('clipboard-api-unavailable')
  } catch (err) {
    // Fallback: copy bằng textarea tạm cho các trình duyệt/WebView không hỗ trợ Clipboard API
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.top = '-9999px'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      textarea.setSelectionRange(0, text.length)
      const successful = document.execCommand('copy')
      document.body.removeChild(textarea)

      if (successful) {
        showCopiedState()
      } else {
        alert('⚠️ Không thể tự động sao chép. Vui lòng nhấn giữ vào thanh địa chỉ để tự sao chép liên kết nhé.')
      }
    } catch (fallbackErr) {
      alert('⚠️ Không thể tự động sao chép. Vui lòng nhấn giữ vào thanh địa chỉ để tự sao chép liên kết nhé.')
    }
  }
}

const continueHere = () => {
  dismissed.value = true
}
</script>

<template>
  <div
    v-if="isInApp && !dismissed"
    class="fixed inset-0 z-[999999] bg-[#090e17]/95 backdrop-blur-xl flex items-center justify-center p-4 text-center font-sans"
    style="padding-top: max(1rem, env(safe-area-inset-top)); padding-bottom: max(1rem, env(safe-area-inset-bottom));"
  >
    <div class="bg-[#111726] border border-blue-500/30 w-full max-w-sm max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-[32px] p-6 shadow-[0_0_50px_rgba(37,99,235,0.15)] relative font-black italic uppercase">

      <div class="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20 shadow-inner">
        <span class="text-3xl not-italic">🔖</span>
      </div>

      <h2 class="text-white text-xl tracking-tight mb-3 leading-tight">
        Giữ trang web để <span class="text-blue-500">quay lại dễ dàng</span>
      </h2>

      <p v-if="platform !== 'ios'" class="text-slate-300 text-[12px] normal-case font-bold leading-relaxed mb-5 not-italic">
        Bạn đang mở trang bằng trình duyệt của Messenger/Zalo. Nếu vô tình vuốt đóng, bạn có thể phải tìm lại liên kết trong tin nhắn. Mở bằng Chrome hoặc Safari giúp trang được giữ lại trong tab để quay lại bất cứ lúc nào.
      </p>
      <p v-else class="text-slate-300 text-[12px] normal-case font-bold leading-relaxed mb-5 not-italic">
        Nếu bạn dùng iPhone, hãy sao chép link trang web rồi dán vào Safari hoặc Chrome để mở trang.
      </p>

      <!-- ANDROID: CTA mở trực tiếp bằng Chrome -->
      <template v-if="platform === 'android'">
        <button
          type="button"
          @click="tryOpenChrome"
          class="w-full py-4 rounded-2xl text-sm tracking-[1px] text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          🌐 Mở bằng Google Chrome
        </button>

        <Transition name="fade">
          <p v-if="androidIntentFailed" class="text-amber-400 text-[11px] normal-case font-bold mt-3 not-italic">
            Không thể tự mở Chrome. Hãy sao chép liên kết bên dưới.
          </p>
        </Transition>
      </template>

      <!-- NÚT SAO CHÉP LIÊN KẾT (dự phòng cho mọi nền tảng) -->
      <button
        type="button"
        @click="copyLink"
        :class="isCopied ? 'bg-emerald-500 shadow-emerald-500/40 text-[#090e17]' : 'bg-[#1a2236] hover:bg-[#212b45] text-white border border-slate-700'"
        class="w-full py-3.5 mt-3 rounded-2xl text-[13px] tracking-[1px] transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
      >
        <span v-if="!isCopied">📋 {{ platform === 'ios' ? 'Sao chép link trang web' : 'Sao chép liên kết' }}</span>
        <span v-else>✓ Đã sao chép liên kết</span>
      </button>

      <!-- LỰA CHỌN PHỤ: tiếp tục dùng web ngay trong trình duyệt hiện tại -->
      <button
        type="button"
        @click="continueHere"
        class="mt-4 text-slate-400 hover:text-slate-200 text-[11px] normal-case font-bold underline underline-offset-2 transition-colors not-italic"
      >
        Tiếp tục tại đây
      </button>

    </div>
  </div>
</template>
