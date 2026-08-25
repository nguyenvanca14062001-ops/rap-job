<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { db } from '@/firebase'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import Swal from 'sweetalert2'
import {
  POST_THREADS_CONFIG_COLLECTION, POST_THREADS_CONFIG_DOC_ID, POST_THREADS_CONFIG_DEFAULT,
  normalizePostThreadsConfig, type PostThreadsJobStatus
} from '@/utils/postThreadsConfig'

const isLoading = ref(true)
const isSaving = ref(false)
const selectedStatus = ref<PostThreadsJobStatus>('open')

const configDocRef = doc(db, POST_THREADS_CONFIG_COLLECTION, POST_THREADS_CONFIG_DOC_ID)
let unsub: any = null

onMounted(() => {
  unsub = onSnapshot(
    configDocRef,
    (snap) => {
      selectedStatus.value = normalizePostThreadsConfig(snap.exists() ? snap.data() : null).status
      isLoading.value = false
    },
    () => { selectedStatus.value = POST_THREADS_CONFIG_DEFAULT.status; isLoading.value = false }
  )
})
onUnmounted(() => { if (unsub) unsub() })

const saveConfig = async () => {
  isSaving.value = true
  try {
    await setDoc(configDocRef, {
      title: POST_THREADS_CONFIG_DEFAULT.title,
      status: selectedStatus.value,
      visible: selectedStatus.value !== 'hidden',
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
  <div class="p-6 max-w-2xl mx-auto">
    <h2 class="text-lg text-fuchsia-600 tracking-widest mb-8">🧵 CẤU HÌNH CÔNG VIỆC ĐĂNG BÀI THREADS</h2>

    <div v-if="isLoading" class="text-center py-10 text-fuchsia-600 text-xs tracking-widest animate-pulse">ĐANG TẢI CẤU HÌNH...</div>

    <div v-else class="bg-[var(--admin-card-soft)] border border-[var(--admin-border)] rounded-2xl p-6 space-y-5">
      <div>
        <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-1">TÊN JOB</label>
        <div class="w-full bg-white text-[var(--admin-text)] text-sm py-2.5 px-3 rounded-xl border border-[var(--admin-border)] font-black italic uppercase">
          ĐĂNG BÀI THREADS
        </div>
      </div>

      <div>
        <label class="text-[10px] text-[var(--admin-muted)] tracking-widest block mb-1">TRẠNG THÁI</label>
        <select v-model="selectedStatus"
          class="w-full bg-white text-[var(--admin-text)] text-sm py-2.5 px-3 rounded-xl border border-[var(--admin-border)] outline-none focus:border-fuchsia-500 font-sans normal-case not-italic">
          <option value="open">Đang mở</option>
          <option value="paused">Tạm dừng</option>
          <option value="hidden">Ẩn</option>
        </select>
      </div>

      <button @click="saveConfig" :disabled="isSaving"
        class="w-full bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black italic uppercase tracking-widest py-4 rounded-2xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-2">
        <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" v-if="isSaving"></div>
        <span>{{ isSaving ? 'ĐANG LƯU...' : '💾 LƯU CẤU HÌNH' }}</span>
      </button>
    </div>
  </div>
</template>
