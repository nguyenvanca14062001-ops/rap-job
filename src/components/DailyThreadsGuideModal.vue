<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Swal from 'sweetalert2'
import { pickRandomNonEmpty } from '@/utils/dailyThreads'

const props = defineProps<{
  show: boolean
  contents: string[]
  postImages: string[]
  qrImage: string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const hasContents = computed(() => (props.contents || []).some(c => String(c || '').trim()))
const hasPostImages = computed(() => (props.postImages || []).some(p => String(p || '').trim()))
const hasQrImage = computed(() => Boolean(String(props.qrImage || '').trim()))

const demoContent = ref('')
const demoImage = ref('')

const resetDemo = () => {
  demoContent.value = pickRandomNonEmpty(props.contents)
  demoImage.value = pickRandomNonEmpty(props.postImages)
}

watch(() => props.show, (val) => { if (val) resetDemo() })

const toast = (icon: 'success' | 'warning', title: string) => {
  Swal.fire({ toast: true, position: 'top', icon, title, showConfirmButton: false, timer: 2000, timerProgressBar: true })
}

const copyContent = async () => {
  const picked = pickRandomNonEmpty(props.contents)
  if (!picked) return
  try {
    await navigator.clipboard.writeText(picked)
    demoContent.value = picked
    toast('success', 'Đã sao chép bài đăng')
  } catch (e) {
    demoContent.value = picked
    toast('warning', 'Không thể sao chép, vui lòng copy thủ công.')
  }
}

async function downloadImageFile(url: string, filename: string) {
  if (!url) return
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  } catch (e) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
}

const isDownloadingPost = ref(false)
const downloadPostImage = async () => {
  const picked = pickRandomNonEmpty(props.postImages)
  if (!picked || isDownloadingPost.value) return
  demoImage.value = picked
  isDownloadingPost.value = true
  try { await downloadImageFile(picked, `thread-post-${Date.now()}.jpg`) }
  finally { isDownloadingPost.value = false }
}

const isDownloadingQr = ref(false)
const downloadQrImage = async () => {
  if (!hasQrImage.value || isDownloadingQr.value) return
  isDownloadingQr.value = true
  try { await downloadImageFile(props.qrImage, `thread-qr-${Date.now()}.jpg`) }
  finally { isDownloadingQr.value = false }
}

const close = () => emit('close')
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[5000] flex items-center justify-center p-2 sm:p-4">
      <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="close"></div>
      <div class="relative bg-[#111726] border border-teal-500/30 w-full max-w-xl rounded-[30px] sm:rounded-[36px] p-5 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto">

        <div class="flex items-start justify-between gap-3 mb-2">
          <div>
            <h2 class="text-lg md:text-xl text-white tracking-tight">📖 HƯỚNG DẪN ĐĂNG BÀI THREADS</h2>
            <p class="text-slate-400 text-[11px] font-sans not-italic normal-case font-medium mt-1">
              Làm theo 3 bước bên dưới rồi quay lại gửi bằng chứng.
            </p>
          </div>
          <button @click="close" class="w-8 h-8 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="bg-teal-500/10 border border-teal-500/25 rounded-2xl px-4 py-3 mb-6 font-sans not-italic normal-case">
          <p class="text-teal-300 text-[11px] font-bold leading-relaxed">
            Làm đủ 3 bước: copy bài đăng → lưu ảnh → ghim QR dưới bình luận.
          </p>
        </div>

        <div class="space-y-5">

          <!-- BƯỚC 1 -->
          <div class="bg-[#0d121f] border border-slate-800 rounded-[26px] p-5">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-8 h-8 shrink-0 rounded-full bg-teal-500 text-[#021617] flex items-center justify-center text-sm shadow-lg">1</div>
              <h3 class="text-teal-400 text-[13px] md:text-sm tracking-tight">BƯỚC 1: SAO CHÉP BÀI ĐĂNG</h3>
            </div>
            <p class="text-slate-400 text-[11px] font-sans not-italic normal-case font-medium leading-relaxed mb-3">
              Bấm nút bên dưới để lấy ngẫu nhiên 1 mẫu nội dung đăng Threads.
            </p>

            <template v-if="hasContents">
              <div class="bg-[#111726] border border-slate-800 rounded-2xl p-4 mb-3 font-sans not-italic normal-case text-slate-300 text-[12px] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                {{ demoContent }}
              </div>
              <button @click="copyContent" class="w-full py-3.5 bg-teal-500 hover:bg-teal-400 text-teal-950 rounded-2xl shadow-lg active:scale-95 transition-all text-[12px] md:text-[13px]">
                📋 SAO CHÉP BÀI ĐĂNG
              </button>
            </template>
            <p v-else class="text-orange-400 text-[11px] font-sans not-italic normal-case font-bold">
              Chưa có nội dung mẫu, vui lòng liên hệ admin.
            </p>
          </div>

          <!-- BƯỚC 2 -->
          <div class="bg-[#0d121f] border border-slate-800 rounded-[26px] p-5">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-8 h-8 shrink-0 rounded-full bg-teal-500 text-[#021617] flex items-center justify-center text-sm shadow-lg">2</div>
              <h3 class="text-teal-400 text-[13px] md:text-sm tracking-tight">BƯỚC 2: LƯU ẢNH BÀI ĐĂNG</h3>
            </div>
            <p class="text-slate-400 text-[11px] font-sans not-italic normal-case font-medium leading-relaxed mb-3">
              Bấm nút bên dưới để tải ngẫu nhiên 1 ảnh dùng kèm bài đăng.
            </p>

            <template v-if="hasPostImages">
              <div class="rounded-2xl overflow-hidden border border-slate-800 mb-3 bg-[#111726] max-w-[220px] mx-auto">
                <img :src="demoImage" class="w-full h-auto object-cover" />
              </div>
              <button @click="downloadPostImage" :disabled="isDownloadingPost" class="w-full py-3.5 bg-teal-500 hover:bg-teal-400 text-teal-950 rounded-2xl shadow-lg active:scale-95 transition-all text-[12px] md:text-[13px] disabled:opacity-50">
                {{ isDownloadingPost ? 'ĐANG TẢI...' : '⬇️ TẢI ẢNH BÀI ĐĂNG' }}
              </button>
            </template>
            <p v-else class="text-orange-400 text-[11px] font-sans not-italic normal-case font-bold">
              Chưa có ảnh mẫu.
            </p>
          </div>

          <!-- BƯỚC 3 -->
          <div class="bg-[#0d121f] border border-slate-800 rounded-[26px] p-5">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-8 h-8 shrink-0 rounded-full bg-teal-500 text-[#021617] flex items-center justify-center text-sm shadow-lg">3</div>
              <h3 class="text-teal-400 text-[13px] md:text-sm tracking-tight">BƯỚC 3: GHIM MÃ QR DƯỚI BÌNH LUẬN</h3>
            </div>
            <p class="text-amber-400/90 text-[10px] font-sans not-italic normal-case font-bold leading-relaxed mb-3">
              ⚠️ Bình luận dưới bài viết: "Quét mã QR vào nhóm để nhận xiền, lụm lúa nhé" + gửi mã QR và ghim bình luận đó lại.
            </p>
            <p class="text-amber-400/90 text-[10px] font-sans not-italic normal-case font-bold leading-relaxed mb-3">
              ⚠️ Kêu gọi mọi người tham gia nhóm, quét mã QR để lụm lúa, lụm xiền. + Đính kèm ẢNH mã QR dưới bình luận VÀ GHIM.
            </p>

            <template v-if="hasQrImage">
              <div class="rounded-2xl overflow-hidden border border-slate-800 mb-3 bg-[#111726] max-w-[220px] mx-auto">
                <img :src="qrImage" class="w-full h-auto object-cover" />
              </div>
              <button @click="downloadQrImage" :disabled="isDownloadingQr" class="w-full py-3.5 bg-teal-500 hover:bg-teal-400 text-teal-950 rounded-2xl shadow-lg active:scale-95 transition-all text-[12px] md:text-[13px] disabled:opacity-50">
                {{ isDownloadingQr ? 'ĐANG TẢI...' : '⬇️ TẢI ẢNH MÃ QR' }}
              </button>
            </template>
            <p v-else class="text-orange-400 text-[11px] font-sans not-italic normal-case font-bold">
              Chưa có ảnh mẫu.
            </p>
          </div>

        </div>

        <button @click="close" class="w-full mt-6 py-3.5 bg-[#0d121f] border border-slate-700 hover:border-teal-500/60 text-white rounded-2xl active:scale-95 transition-all text-[12px] md:text-[13px]">
          ĐÃ HIỂU, ĐÓNG HƯỚNG DẪN
        </button>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
