<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { auth, db } from '@/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const JOB_ID = 'shopee-pay'

const isLoading = ref(false)
const history = ref<any[]>([])
const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime()

const loadHistory = async () => {
  const uid = auth.currentUser?.uid
  if (!uid) return
  isLoading.value = true
  try {
    const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', uid), where('jobId', '==', JOB_ID)))
    history.value = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => getTime(b.createdAt) - getTime(a.createdAt))
  } catch (err: any) {
    alert('❌ LỖI TẢI LỊCH SỬ: ' + (err?.message || 'Vui lòng thử lại.'))
  } finally {
    isLoading.value = false
  }
}

watch(() => props.show, (v) => { if (v) loadHistory() })

const handleClose = () => emit('close')

const formatDate = (ts: any) => {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

const statusLabel = (rp: any) => {
  if (rp.status === 'pending') return 'ĐANG CHỜ DUYỆT'
  if (rp.status === 'rejected') return 'BỊ TỪ CHỐI'
  return `ĐÃ DUYỆT — +${(rp.actualReward || rp.reward || 0).toLocaleString()} XU`
}
const statusClass = (rp: any) => {
  if (rp.status === 'pending') return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
  if (rp.status === 'rejected') return 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
  return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[5300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="handleClose"></div>

      <div class="relative bg-[#111726] border border-slate-800 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[85vh] overflow-y-auto text-left font-black italic uppercase">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg text-white tracking-tight">📜 LỊCH SỬ NỘP ĐƠN</h2>
          <button @click="handleClose" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div v-if="isLoading" class="text-center py-12">
          <div class="text-4xl mb-3 animate-pulse">⏳</div>
          <p class="text-slate-500 text-[11px] normal-case font-bold leading-relaxed">Đang tải lịch sử...</p>
        </div>

        <div v-else-if="!history.length" class="text-center py-12">
          <div class="text-4xl mb-3">📭</div>
          <p class="text-slate-500 text-[11px] normal-case font-bold leading-relaxed">Bạn chưa có đơn SHOPEE PAY nào.</p>
        </div>

        <div v-else class="space-y-3">
          <div v-for="rp in history" :key="rp.id" class="bg-[#0d121f] border rounded-2xl p-4"
               :class="rp.status === 'rejected' ? 'border-rose-500/30' : rp.status === 'pending' ? 'border-yellow-500/20' : 'border-emerald-500/20'">
            <div class="flex justify-between items-start gap-3 mb-2">
              <div class="font-sans not-italic normal-case min-w-0">
                <p class="text-white text-[12px] font-bold truncate">{{ rp.bankAccountHolderName || rp.fullName || rp.username }}</p>
                <p class="text-slate-500 text-[10px]">SĐT: {{ rp.bankRegisteredPhone || rp.phoneRef }}</p>
                <p class="text-slate-600 text-[9px] mt-1">{{ formatDate(rp.createdAt) }}</p>
              </div>
              <span class="shrink-0 text-[9px] px-2 py-1 rounded-full font-sans not-italic normal-case" :class="statusClass(rp)">
                {{ statusLabel(rp) }}
              </span>
            </div>
            <p v-if="rp.status === 'rejected' && rp.note" class="text-rose-400 text-[10px] font-sans not-italic normal-case mt-1 leading-relaxed">Lý do: {{ rp.note }}</p>

            <div v-if="rp.proofImages?.length" class="grid grid-cols-3 gap-2 mt-3">
              <div v-for="(img, idx) in rp.proofImages" :key="idx" @click="openImage(img.url || img)"
                   class="relative rounded-lg overflow-hidden border border-slate-700/60 bg-slate-900 aspect-square cursor-zoom-in">
                <img class="w-full h-full object-cover" :src="img.url || img" />
              </div>
            </div>
          </div>
        </div>
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
