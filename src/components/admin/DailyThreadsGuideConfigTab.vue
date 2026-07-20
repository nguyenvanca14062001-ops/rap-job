<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { db } from '@/firebase'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import Swal from 'sweetalert2'
import {
  DAILY_THREAD_GUIDE_COLLECTION, DAILY_THREAD_GUIDE_DOC_ID, DAILY_THREAD_GUIDE_DEFAULT,
  DAILY_THREAD_GUIDE_ITEM_COUNT, normalizeDailyThreadGuideConfig
} from '@/utils/dailyThreads'

const isOpen = ref(false)
const isLoading = ref(true)
const isSaving = ref(false)

const contents = ref<string[]>(Array(DAILY_THREAD_GUIDE_ITEM_COUNT).fill(''))
const postImages = ref<string[]>(Array(DAILY_THREAD_GUIDE_ITEM_COUNT).fill(''))
const qrImage = ref('')

const configDocRef = doc(db, DAILY_THREAD_GUIDE_COLLECTION, DAILY_THREAD_GUIDE_DOC_ID)
let unsub: any = null

const applyConfig = (raw: any) => {
  const cfg = normalizeDailyThreadGuideConfig(raw)
  const c = [...cfg.contents]; while (c.length < DAILY_THREAD_GUIDE_ITEM_COUNT) c.push('')
  const p = [...cfg.postImages]; while (p.length < DAILY_THREAD_GUIDE_ITEM_COUNT) p.push('')
  contents.value = c.slice(0, DAILY_THREAD_GUIDE_ITEM_COUNT)
  postImages.value = p.slice(0, DAILY_THREAD_GUIDE_ITEM_COUNT)
  qrImage.value = cfg.qrImage
}

onMounted(() => {
  unsub = onSnapshot(
    configDocRef,
    (snap) => { applyConfig(snap.exists() ? snap.data() : null); isLoading.value = false },
    () => { applyConfig(DAILY_THREAD_GUIDE_DEFAULT); isLoading.value = false }
  )
})
onUnmounted(() => { if (unsub) unsub() })

const saveConfig = async () => {
  const cleanContents = contents.value.map(c => c.trim())
  if (!cleanContents.some(c => c)) {
    Swal.fire({ icon: 'warning', title: 'CẦN ÍT NHẤT 1 NỘI DUNG', text: 'Vui lòng nhập tối thiểu 1 nội dung bài đăng không rỗng.', confirmButtonColor: '#14b8a6' })
    return
  }
  isSaving.value = true
  try {
    await setDoc(configDocRef, {
      contents: cleanContents,
      postImages: postImages.value.map(p => p.trim()),
      qrImage: qrImage.value.trim(),
      updatedAt: serverTimestamp()
    }, { merge: true })
    Swal.fire({ icon: 'success', title: 'ĐÃ LƯU CẤU HÌNH', timer: 1200, showConfirmButton: false })
  } catch (e: any) {
    Swal.fire('LỖI!', e?.message || 'Không thể lưu cấu hình, vui lòng thử lại.', 'error')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="border-b border-slate-800">
    <button @click="isOpen = !isOpen" class="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-all">
      <h2 class="text-sm md:text-base text-teal-400 tracking-widest">⚙️ CẤU HÌNH HƯỚNG DẪN THREADS HẰNG NGÀY</h2>
      <span class="text-slate-500 text-xs">{{ isOpen ? '▲ THU GỌN' : '▼ MỞ RỘNG' }}</span>
    </button>

    <div v-if="isOpen" class="p-5 pt-0 space-y-6">
      <div v-if="isLoading" class="text-center py-10 text-teal-500 text-xs tracking-widest animate-pulse">ĐANG TẢI CẤU HÌNH...</div>

      <template v-else>
        <!-- 10 NỘI DUNG BÀI ĐĂNG -->
        <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-5 space-y-3">
          <label class="text-[10px] text-slate-500 tracking-widest block">10 NỘI DUNG BÀI ĐĂNG (user sẽ được random 1 trong các nội dung không rỗng)</label>
          <div v-for="(c, i) in contents" :key="'content-' + i" class="space-y-1">
            <span class="text-[9px] text-slate-600 font-sans not-italic normal-case font-bold">Content #{{ i + 1 }}</span>
            <textarea v-model="contents[i]" rows="2" :placeholder="`Nội dung bài đăng mẫu ${i + 1}...`"
              class="w-full bg-[#111726] text-white text-[12px] py-2.5 px-3 rounded-xl border border-slate-700 outline-none focus:border-teal-500 font-sans normal-case not-italic resize-none"></textarea>
          </div>
        </div>

        <!-- 10 ẢNH BÀI ĐĂNG -->
        <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-5 space-y-3">
          <label class="text-[10px] text-slate-500 tracking-widest block">10 ẢNH BÀI ĐĂNG (link hoặc path ảnh, vd: /images/thread-post-1.jpg)</label>
          <div v-for="(_, i) in postImages" :key="'image-' + i" class="space-y-1">
            <span class="text-[9px] text-slate-600 font-sans not-italic normal-case font-bold">Image #{{ i + 1 }}</span>
            <input v-model="postImages[i]" type="text" :placeholder="`/images/thread-post-${i + 1}.jpg`"
              class="w-full bg-[#111726] text-white text-[12px] py-2.5 px-3 rounded-xl border border-slate-700 outline-none focus:border-teal-500 font-sans normal-case not-italic" />
          </div>
        </div>

        <!-- ẢNH MÃ QR -->
        <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-5 space-y-3">
          <label class="text-[10px] text-slate-500 tracking-widest block">ẢNH MÃ QR (qrImage)</label>
          <input v-model="qrImage" type="text" placeholder="/images/thread-qr.jpg"
            class="w-full bg-[#111726] text-white text-[12px] py-2.5 px-3 rounded-xl border border-slate-700 outline-none focus:border-teal-500 font-sans normal-case not-italic" />
        </div>

        <button @click="saveConfig" :disabled="isSaving"
          class="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black italic uppercase tracking-widest py-4 rounded-2xl transition-all active:scale-95 shadow-[0_0_20px_rgba(20,184,166,0.3)] flex items-center justify-center gap-2">
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" v-if="isSaving"></div>
          <span>{{ isSaving ? 'ĐANG LƯU...' : '💾 LƯU NỘI DUNG THREADS' }}</span>
        </button>
      </template>
    </div>
  </div>
</template>
