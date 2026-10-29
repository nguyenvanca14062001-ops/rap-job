<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/firebase'
import { collection, doc, addDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { jobsData } from '@/data/jobs'
import type { Story, StoryOptionId } from '@/data/stories'
import { STORY_CHOICE_JOB_ID } from '@/utils/storyChoice'

// Popup job "ĐỌC TRUYỆN – CHỌN CÁCH XỬ LÝ": đọc 1 truyện bốc ngẫu nhiên → chọn A/B/C → xem đoạn kết → gửi đơn.
// Gửi đơn 'pending' vào reports như job cơ bản khác, không cần ảnh / nhập chữ và KHÔNG cộng xu ở đây —
// Admin duyệt và cộng xu bằng approveReport()/duyệt hàng loạt có sẵn (AdminView.vue, số xu lấy từ getTrustedReward).
const props = defineProps<{ show: boolean; job?: any; myReports?: any[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()

// job: bản đã merge cấu hình Admin (mergedJobs ở App.vue); thiếu thì dùng cấu hình tĩnh trong jobs.ts
const staticJob = jobsData[STORY_CHOICE_JOB_ID]
const jobConfig = computed(() => props.job || staticJob)
const rewardAmount = computed(() => Number(String(jobConfig.value?.reward ?? '').replace(/\D/g, '')) || 0)
const rewardText = computed(() => `${rewardAmount.value.toLocaleString('vi-VN')} xu`)
const stories = computed<Story[]>(() => jobConfig.value?.stories || staticJob.stories || [])

// --- Truyện đang đọc + phương án đã chọn: bốc ngẫu nhiên ở lần mở popup đầu tiên, nhớ trong sessionStorage để
// đóng/mở lại popup hay F5 (kể cả khi Admin ép tải lại) vẫn giữ đúng truyện. Gửi đơn xong thì xoá → lần làm lại
// (đơn bị từ chối) bốc truyện mới.
const SESSION_KEY = 'mmo_story_choice'

const readSession = (): { storyId?: string; choice?: string | null } => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}') || {} } catch { return {} }
}
const writeSession = (storyId: string | null, choice: StoryOptionId | null = null) => {
  try {
    if (storyId) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ storyId, choice }))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch { /* storage bị chặn (VD Safari ẩn danh) — vẫn làm bình thường, chỉ không nhớ được qua F5 */ }
}

const storyId = ref<string | null>(null)
const choice = ref<StoryOptionId | null>(null)
const story = computed(() => stories.value.find(s => s.id === storyId.value) || null)
const selectedOption = computed(() => story.value?.options.find(o => o.id === choice.value) || null)

const pickStory = () => {
  const list = stories.value
  const saved = readSession()
  const savedStory = list.find(s => s.id === saved.storyId)
  if (savedStory) {
    storyId.value = savedStory.id
    choice.value = savedStory.options.find(o => o.id === saved.choice)?.id ?? null
    return
  }
  // Truyện đã lưu không còn trong danh sách (vừa sửa/xoá truyện) hoặc chưa có → bốc truyện mới
  storyId.value = list[Math.floor(Math.random() * list.length)]?.id ?? null
  choice.value = null
  writeSession(storyId.value)
}

watch(choice, (c) => { if (storyId.value) writeSession(storyId.value, c) })

const getTime = (ts: any) => ts?.toDate ? ts.toDate().getTime() : new Date(ts || 0).getTime()
const myStoryReports = computed(() =>
  (props.myReports || [])
    .filter(r => r.jobId === STORY_CHOICE_JOB_ID)
    .slice()
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
)
// Đơn đang chờ / đã duyệt → không cho gửi lại (1 lần/tài khoản như job cơ bản khác); đơn bị từ chối thì được làm lại
const activeReport = computed(() => myStoryReports.value.find(r => ['pending', 'approved', 'collected'].includes(r.status)))
const lastRejected = computed(() => myStoryReports.value.find(r => r.status === 'rejected'))

const submitting = ref(false)
const showSuccess = ref(false)
const submittedInfo = ref<{ choice: StoryOptionId; storyTitle: string } | null>(null)
// Thông báo hiện ngay trong popup, ngay trên nút gửi (không bật thêm hộp thoại).
// blocked: Firestore báo tài khoản đã có đơn chờ duyệt / đã nhận thưởng → khoá nút gửi.
const notice = ref<{ text: string; blocked: boolean } | null>(null)

const canSubmit = computed(() => !activeReport.value && !!selectedOption.value && !submitting.value && !notice.value?.blocked)
const submitHint = computed(() => {
  if (!story.value) return ''
  return selectedOption.value
    ? `Đã chọn phương án ${selectedOption.value.id} · có thể đổi trước khi gửi.`
    : 'Chọn 1 phương án A, B hoặc C để xem diễn biến và gửi.'
})

const endingEl = ref<HTMLElement | null>(null)
const choose = async (id: StoryOptionId) => {
  if (activeReport.value || submitting.value) return
  choice.value = id
  if (notice.value && !notice.value.blocked) notice.value = null
  // Đoạn kết hiện ngay dưới 3 phương án — cuộn nhẹ để không bị khuất sau nút gửi trên màn hình thấp
  await nextTick()
  endingEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

watch(() => props.show, (open) => {
  if (!open) return
  notice.value = null
  if (!story.value) pickStory()
}, { immediate: true })

const close = () => {
  if (submitting.value) return
  emit('close')
}

const submitChoice = async () => {
  const s = story.value
  const opt = selectedOption.value
  if (!canSubmit.value || !s || !opt) return
  const user = auth.currentUser
  if (!user) {
    emit('close')
    router.push('/login')
    return
  }

  submitting.value = true
  notice.value = null
  try {
    // 1 lần/tài khoản: kiểm tra lại trên Firestore giống SubmitReportView (myReports chỉ có 50 đơn gần nhất)
    const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', user.uid), where('jobId', '==', STORY_CHOICE_JOB_ID)))
    const statuses = snap.docs.map(d => d.data().status)
    if (statuses.some(st => st === 'approved' || st === 'collected')) {
      notice.value = { text: 'Bạn đã nhận thưởng công việc này rồi. Mỗi tài khoản chỉ được làm 1 lần.', blocked: true }
      return
    }
    if (statuses.includes('pending')) {
      notice.value = { text: 'Bạn đã gửi lựa chọn cho công việc này rồi, vui lòng chờ Admin duyệt.', blocked: true }
      return
    }

    const userSnap = await getDoc(doc(db, 'users', user.uid))
    const userDoc: any = userSnap.exists() ? userSnap.data() : {}

    // Đơn 'pending' giống MusicVoteModal — Admin xem truyện + phương án ở cột BẰNG CHỨNG rồi duyệt như job cơ bản
    // khác. reward chỉ để hiển thị lịch sử; số xu cộng thật Admin lấy từ cấu hình job (getTrustedReward).
    await addDoc(collection(db, 'reports'), {
      uid: user.uid,
      username: userDoc.username || '',
      fullName: userDoc.fullName || '',
      phoneRef: userDoc.phoneRef || userDoc.phone || '',
      jobId: STORY_CHOICE_JOB_ID,
      jobName: jobConfig.value?.title || staticJob.title,
      reward: rewardAmount.value,
      storyId: s.id,
      storyTitle: s.title,
      storyChoice: opt.id,
      storyChoiceLabel: opt.label,
      status: 'pending',
      createdAt: serverTimestamp(),
      site: 'rapjob'
    })

    submittedInfo.value = { choice: opt.id, storyTitle: s.title }
    writeSession(null)
    showSuccess.value = true
  } catch (error: any) {
    notice.value = { text: `Gửi chưa thành công: ${error?.message || 'vui lòng thử lại!'}`, blocked: false }
  } finally {
    submitting.value = false
  }
}

const finishSuccess = () => {
  showSuccess.value = false
  storyId.value = null
  choice.value = null
  emit('close')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[5200] flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="close"></div>

      <div class="relative w-full max-w-md max-h-full flex flex-col overflow-hidden rounded-[28px] border border-red-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-left">
        <!-- Nền đặc (cùng màu bg-white/10 trên nền popup) để chữ truyện không lộ qua nút khi cuộn -->
        <button @click="close" aria-label="Đóng" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-[#352a28] shadow-[0_2px_10px_rgba(0,0,0,0.5)] text-slate-300 flex items-center justify-center active:scale-90 transition-transform">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 min-[375px]:p-5">
          <!-- Tiêu đề + thưởng + mô tả -->
          <h2 class="pr-10 text-white text-[17px] min-[375px]:text-[18px] leading-tight uppercase">{{ jobConfig?.icon }} {{ jobConfig?.title }}</h2>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <span class="px-2.5 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-[11.5px] font-black">Thưởng: {{ rewardText }}</span>
            <span class="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[11.5px] font-bold">Chỉ làm 1 lần</span>
            <span class="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[11.5px] font-bold">Không cần ảnh</span>
          </div>
          <p class="mt-2.5 text-slate-300 text-[13.5px] font-medium leading-relaxed">{{ jobConfig?.shortDesc }}</p>

          <!-- Đã gửi lựa chọn (đang chờ / đã duyệt) -->
          <div v-if="activeReport" class="mt-4 rounded-2xl border p-4"
               :class="activeReport.status === 'pending' ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-emerald-500/30 bg-emerald-500/10'">
            <p class="text-[14.5px] font-black leading-snug" :class="activeReport.status === 'pending' ? 'text-yellow-300' : 'text-emerald-300'">
              {{ activeReport.status === 'pending' ? '⏳ Lựa chọn của bạn đang chờ Admin duyệt' : '✅ Bạn đã hoàn thành công việc này' }}
            </p>
            <p v-if="activeReport.storyTitle" class="mt-1.5 text-slate-300 text-[13px] font-medium">
              Truyện: <span class="text-white font-black">{{ activeReport.storyTitle }}</span>
            </p>
            <p v-if="activeReport.storyChoice" class="mt-0.5 text-slate-300 text-[13px] font-medium">
              Lựa chọn: <span class="text-white font-black">Phương án {{ activeReport.storyChoice }}<template v-if="activeReport.storyChoiceLabel"> – {{ activeReport.storyChoiceLabel }}</template></span>
            </p>
            <p class="mt-1 text-slate-400 text-[12px] font-medium">Mỗi tài khoản chỉ được làm công việc này 1 lần.</p>
          </div>

          <template v-else-if="story">
            <p v-if="lastRejected" class="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-rose-300 text-[12.5px] font-semibold leading-snug">
              Đơn trước bị từ chối<template v-if="lastRejected.note">: {{ lastRejected.note }}</template>. Bạn có thể đọc truyện và gửi lựa chọn mới.
            </p>

            <!-- Truyện -->
            <article class="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div class="flex flex-wrap gap-1.5">
                <span v-for="tag in story.tags" :key="tag" class="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-red-300 text-[10.5px] font-bold">{{ tag }}</span>
              </div>
              <h3 class="mt-2.5 text-yellow-300 text-[17px] leading-snug">{{ story.title }}</h3>
              <div class="mt-2.5 space-y-3 text-slate-200 text-[15px] leading-[1.6]">
                <p v-for="(para, idx) in story.paragraphs" :key="idx">{{ para }}</p>
              </div>
            </article>

            <!-- Chọn cách xử lý A / B / C -->
            <section class="mt-4">
              <p class="text-white text-[15px] font-black leading-snug">Nếu bạn là nhân vật chính, bạn sẽ xử lý thế nào?</p>
              <div class="mt-2.5 space-y-2">
                <button v-for="opt in story.options" :key="opt.id" @click="choose(opt.id)" :aria-pressed="choice === opt.id"
                        class="w-full flex items-start gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-colors"
                        :class="choice === opt.id
                          ? 'border-yellow-400 bg-red-600/20 shadow-[0_0_18px_rgba(250,204,21,0.15)]'
                          : 'border-white/10 bg-white/[0.04] active:bg-white/[0.08]'">
                  <span class="mt-px w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[13px] font-black"
                        :class="choice === opt.id ? 'bg-yellow-400 text-[#3a0a00]' : 'bg-white/10 text-slate-200'">{{ opt.id }}</span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-white text-[14.5px] font-black leading-snug">{{ opt.label }}</span>
                    <span class="block mt-0.5 text-slate-400 text-[12.5px] font-medium leading-snug">{{ opt.hint }}</span>
                  </span>
                </button>
              </div>
            </section>

            <!-- Đoạn kết theo phương án đã chọn — chỉ hiện sau khi chọn, đổi phương án là đổi đoạn kết -->
            <section v-if="selectedOption" ref="endingEl" aria-live="polite" class="mt-4 scroll-mb-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.06] p-4">
              <p class="text-yellow-400 text-[12px] font-black uppercase tracking-wide">Diễn biến theo lựa chọn của bạn</p>
              <p class="mt-1 text-white text-[13px] font-bold">Phương án {{ selectedOption.id }} · {{ selectedOption.label }}</p>
              <p class="mt-2 text-slate-200 text-[15px] leading-[1.6]">{{ selectedOption.ending }}</p>
            </section>
          </template>

          <p v-else class="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-amber-300 text-[12.5px] font-semibold leading-snug">
            📖 Truyện đang được cập nhật, vui lòng quay lại sau.
          </p>
        </div>

        <!-- Nút gửi luôn nằm dưới cùng popup, không bị cuộn mất hay bị thanh điều hướng che -->
        <div v-if="!activeReport" class="shrink-0 border-t border-white/10 bg-[#120b0a] px-4 min-[375px]:px-5 pt-2.5 pb-3.5">
          <p v-if="notice" class="mb-2 text-center text-[12px] font-bold leading-snug" :class="notice.blocked ? 'text-yellow-300' : 'text-rose-400'">⚠️ {{ notice.text }}</p>
          <p v-else-if="submitHint" class="mb-2 text-center text-[11.5px] font-medium" :class="selectedOption ? 'text-yellow-400' : 'text-slate-400'">{{ submitHint }}</p>
          <button @click="submitChoice" :disabled="!canSubmit"
                  class="w-full h-12 rounded-xl text-[14px] font-black uppercase tracking-wide transition-transform"
                  :class="canSubmit
                    ? 'bg-gradient-to-r from-yellow-300 to-amber-400 text-[#3a0a00] shadow-[0_4px_16px_rgba(251,191,36,0.35)] active:scale-[0.98]'
                    : 'bg-slate-700/70 text-slate-400 cursor-not-allowed'">
            {{ submitting ? 'ĐANG GỬI...' : `GỬI LỰA CHỌN – ${rewardText.toUpperCase()}` }}
          </button>
        </div>
      </div>

      <!-- Gửi thành công — đơn chờ Admin duyệt -->
      <div v-if="showSuccess" class="fixed inset-0 z-[5600] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="finishSuccess"></div>
        <div class="relative w-full max-w-sm rounded-[28px] border border-emerald-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] p-6 text-center shadow-2xl">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl">✅</div>
          <h3 class="mt-4 text-white text-[18px] leading-tight uppercase">Gửi lựa chọn thành công</h3>
          <p class="mt-2 text-slate-400 text-[13px] font-medium leading-relaxed">
            Bạn đã chọn <span class="text-white font-black">phương án {{ submittedInfo?.choice }}</span> cho truyện
            <span class="text-white font-black">“{{ submittedInfo?.storyTitle }}”</span>. Đơn đang
            <span class="text-yellow-400 font-bold">chờ Admin duyệt</span>, xu sẽ được cộng vào ví sau khi duyệt.
          </p>
          <div class="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 py-2.5 text-yellow-400 text-[15px] font-black">
            +{{ rewardText }} · CHỜ DUYỆT
          </div>
          <button @click="finishSuccess" class="mt-5 w-full h-12 rounded-xl bg-red-600 active:bg-red-500 text-white text-[14px] font-black uppercase tracking-wide transition-colors">
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
