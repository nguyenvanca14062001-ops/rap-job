<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  show: boolean
  contents: string[]
  postImages: string[]
  qrImage: string
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const hasQrImage = computed(() => Boolean(String(props.qrImage || '').trim()))

// Ảnh hướng dẫn tĩnh cho BƯỚC 1 (đăng bài tương tự ảnh mẫu trên Threads) — không lấy từ postImages nữa.
const THREADS_GUIDE_IMAGE = '/images/anh-threads-huongdan.jpg'

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

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
              Làm theo 2 bước bên dưới rồi quay lại gửi bằng chứng.
            </p>
          </div>
          <button @click="close" class="w-8 h-8 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div class="bg-teal-500/10 border border-teal-500/25 rounded-2xl px-4 py-3 mb-6 font-sans not-italic normal-case">
          <p class="text-teal-300 text-[11px] font-bold leading-relaxed">
            Làm đủ 2 bước: đăng bài tương tự ảnh mẫu trên Threads → ghim QR nhóm Zalo dưới bình luận.
          </p>
        </div>

        <div class="space-y-5">

          <!-- BƯỚC 1 -->
          <div class="bg-[#0d121f] border border-slate-800 rounded-[26px] p-5">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-8 h-8 shrink-0 rounded-full bg-teal-500 text-[#021617] flex items-center justify-center text-sm shadow-lg">1</div>
              <h3 class="text-teal-400 text-[13px] md:text-sm tracking-tight">BƯỚC 1: LÊN THREADS, SAO CHÉP BÀI TƯƠNG TỰ ẢNH MẪU</h3>
            </div>
            <p class="text-slate-400 text-[11px] font-sans not-italic normal-case font-medium leading-relaxed mb-1">
              1/ Tìm và sao chép (đăng lại) các bài đăng dạng "nhận tiền", "thả tim nhận tiền"... bất kỳ trên Threads, tương tự như ảnh mẫu bên dưới.
            </p>
            <p class="text-slate-400 text-[11px] font-sans not-italic normal-case font-medium leading-relaxed mb-3">
              2/ Ghim mã QR nhóm Zalo dưới bình luận — tải ảnh QR nhóm Zalo ngay tại Bước 2 bên dưới.
            </p>

            <div class="rounded-2xl overflow-hidden border border-slate-800 bg-[#111726] max-w-[220px] mx-auto cursor-zoom-in relative"
                 @click="openImage(THREADS_GUIDE_IMAGE)">
              <img :src="THREADS_GUIDE_IMAGE" class="w-full h-auto object-cover" />
              <div class="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-white text-[8px] px-2 py-1 rounded">🔍 CHẠM ĐỂ PHÓNG TO</div>
            </div>
          </div>

          <!-- BƯỚC 2 -->
          <div class="bg-[#0d121f] border border-slate-800 rounded-[26px] p-5">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-8 h-8 shrink-0 rounded-full bg-teal-500 text-[#021617] flex items-center justify-center text-sm shadow-lg">2</div>
              <h3 class="text-teal-400 text-[13px] md:text-sm tracking-tight">BƯỚC 2: GHIM MÃ QR NHÓM ZALO DƯỚI BÌNH LUẬN</h3>
            </div>
            <p class="text-amber-400/90 text-[10px] font-sans not-italic normal-case font-bold leading-relaxed mb-3">
              ⚠️ Bình luận dưới bài viết: "Quét mã QR vào nhóm Zalo để nhận xiền, lụm lúa nhé" + gửi mã QR và ghim bình luận đó lại.
            </p>
            <p class="text-amber-400/90 text-[10px] font-sans not-italic normal-case font-bold leading-relaxed mb-3">
              ⚠️ Kêu gọi mọi người tham gia nhóm Zalo, quét mã QR để lụm lúa, lụm xiền. + Đính kèm ẢNH mã QR nhóm Zalo dưới bình luận VÀ GHIM.
            </p>

            <template v-if="hasQrImage">
              <div class="rounded-2xl overflow-hidden border border-slate-800 mb-3 bg-[#111726] max-w-[220px] mx-auto">
                <img :src="qrImage" class="w-full h-auto object-cover" />
              </div>
              <button @click="downloadQrImage" :disabled="isDownloadingQr" class="w-full py-3.5 bg-teal-500 hover:bg-teal-400 text-teal-950 rounded-2xl shadow-lg active:scale-95 transition-all text-[12px] md:text-[13px] disabled:opacity-50">
                {{ isDownloadingQr ? 'ĐANG TẢI...' : '⬇️ TẢI ẢNH QR NHÓM ZALO' }}
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

      <div v-if="selectedImage" class="fixed inset-0 z-[5700] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" @click="closeImage">
        <button class="absolute top-6 right-6 w-11 h-11 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white z-[5710]" @click.stop="closeImage">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <img class="max-w-full max-h-[90vh] rounded-2xl object-contain cursor-default" :src="selectedImage" @click.stop />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
