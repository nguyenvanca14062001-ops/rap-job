<script setup lang="ts">
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import Swal from 'sweetalert2'
import { auth, db } from '@/firebase'
import { collection, doc, addDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { jobsData } from '@/data/jobs'
import { MUSIC_VOTE_JOB_ID } from '@/utils/musicVote'

// Popup job "NGHE NHẠC – CHỌN BÀI HAY HƠN": nghe 2 đoạn MP3 tĩnh (public/audio/, Cloudflare Pages phục vụ) rồi chọn A/B.
// Gửi đơn 'pending' vào reports như job cơ bản khác, không cần ảnh và KHÔNG cộng xu ở đây —
// Admin duyệt và cộng xu bằng approveReport()/duyệt hàng loạt có sẵn (AdminView.vue).
const props = defineProps<{ show: boolean; job?: any; myReports?: any[] }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const router = useRouter()
const baseUrl = import.meta.env.BASE_URL

// job: bản đã merge cấu hình Admin (mergedJobs ở App.vue); thiếu thì dùng cấu hình tĩnh trong jobs.ts
const staticJob = jobsData[MUSIC_VOTE_JOB_ID]
const jobConfig = computed(() => props.job || staticJob)
const rewardAmount = computed(() => Number(String(jobConfig.value?.reward ?? '').replace(/\D/g, '')) || 0)
const rewardText = computed(() => `${rewardAmount.value.toLocaleString('vi-VN')} xu`)
const minListenSeconds = computed(() => Number(jobConfig.value?.minListenSeconds) || 15)

type TrackId = 'A' | 'B'
// checking: đang kiểm tra file · ready: có file · missing: chưa có file MP3 · error: không tải được (mất mạng...)
type TrackStatus = 'checking' | 'ready' | 'missing' | 'error'
interface Track {
  id: TrackId
  label: string
  src: string
  status: TrackStatus
  playing: boolean
  buffering: boolean
  currentTime: number
  duration: number
  listened: number // số giây nghe thật, chỉ cộng khi đang phát liên tục — tua/nhảy thời gian không tính
  lastTime: number
}

const tracks = reactive<Track[]>(
  ((jobConfig.value?.audioTracks || staticJob.audioTracks) as { id: TrackId; label: string; src: string }[]).map((t): Track => ({
    id: t.id,
    label: t.label,
    src: baseUrl + t.src,
    status: 'checking',
    playing: false,
    buffering: false,
    currentTime: 0,
    duration: 0,
    listened: 0,
    lastTime: 0,
  }))
)

const audioEls: Partial<Record<TrackId, HTMLAudioElement>> = {}
const setAudioEl = (id: TrackId, el: unknown) => {
  if (el instanceof HTMLAudioElement) audioEls[id] = el
  else delete audioEls[id]
}

// Kiểm tra file trước khi cho phát. Cloudflare Pages (chế độ SPA) trả index.html mã 200 cho file không tồn tại,
// nên phải xét cả Content-Type chứ không chỉ res.ok. no-store để chép file mới lên là nhận ngay.
const checkTrack = async (t: Track) => {
  t.status = 'checking'
  try {
    const res = await fetch(t.src, { method: 'HEAD', cache: 'no-store' })
    const type = (res.headers.get('content-type') || '').toLowerCase()
    t.status = res.ok && !type.includes('text/html') ? 'ready' : 'missing'
  } catch {
    t.status = 'error'
  }
}

// Đoạn ngắn hơn mốc thì phải nghe hết đoạn (chừa 0,5 giây sai số vì timeupdate chỉ báo khoảng 4 lần/giây)
const isShortTrack = (t: Track) => t.duration > 0 && t.duration < minListenSeconds.value
const requiredSeconds = (t: Track) => isShortTrack(t) ? Math.max(t.duration - 0.5, 0) : minListenSeconds.value
const requiredLabel = (t: Track) => isShortTrack(t) ? Math.round(t.duration) : minListenSeconds.value
const isDone = (t: Track) => t.status === 'ready' && t.listened >= requiredSeconds(t)

const musicUnavailable = computed(() => tracks.some(t => t.status === 'missing' || t.status === 'error'))
const canChoose = computed(() => tracks.every(isDone))

const choice = ref<TrackId | null>(null)
const submitting = ref(false)
const showSuccess = ref(false)
const submittedChoice = ref<TrackId | null>(null)

const getTime = (ts: any) => ts?.toDate ? ts.toDate().getTime() : new Date(ts || 0).getTime()
const myVoteReports = computed(() =>
  (props.myReports || [])
    .filter(r => r.jobId === MUSIC_VOTE_JOB_ID)
    .slice()
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
)
// Đơn đang chờ / đã duyệt → không cho gửi lại (1 lần/tài khoản như job cơ bản khác); đơn bị từ chối thì được làm lại
const activeReport = computed(() => myVoteReports.value.find(r => ['pending', 'approved', 'collected'].includes(r.status)))
const lastRejected = computed(() => myVoteReports.value.find(r => r.status === 'rejected'))

const canSubmit = computed(() => !activeReport.value && !musicUnavailable.value && canChoose.value && !!choice.value && !submitting.value)

const choiceHint = computed(() => {
  if (musicUnavailable.value) return 'Chưa có nhạc nên chưa thể chọn và gửi đánh giá.'
  if (!canChoose.value) return 'Nghe đủ cả 2 đoạn nhạc để mở khóa phần bình chọn.'
  return choice.value ? `Bạn đã chọn: Đoạn nhạc ${choice.value}` : 'Chọn 1 đoạn nhạc bạn thích hơn.'
})

const choose = (id: TrackId) => { if (canChoose.value && !activeReport.value) choice.value = id }

// --- Trình phát: chỉ 1 đoạn phát tại 1 thời điểm ---
const countListen = (t: Track, now: number) => {
  const delta = now - t.lastTime
  if (delta > 0 && delta <= 1.5) t.listened += delta
  t.lastTime = now
}

const onMeta = (t: Track) => {
  const d = audioEls[t.id]?.duration
  if (d && Number.isFinite(d)) t.duration = d
}

const onTimeUpdate = (t: Track) => {
  const el = audioEls[t.id]
  if (!el) return
  t.currentTime = el.currentTime
  if (el.paused) t.lastTime = el.currentTime
  else countListen(t, el.currentTime)
}

const onPlay = (t: Track) => {
  t.playing = true
  t.lastTime = audioEls[t.id]?.currentTime ?? 0
  for (const other of tracks) if (other.id !== t.id) audioEls[other.id]?.pause()
}

const onPause = (t: Track) => { t.playing = false; t.buffering = false }

const onEnded = (t: Track) => {
  const el = audioEls[t.id]
  if (el) countListen(t, Number.isFinite(el.duration) ? el.duration : el.currentTime)
  t.playing = false
  t.buffering = false
}

const onError = (t: Track) => {
  const el = audioEls[t.id]
  t.playing = false
  t.buffering = false
  // MEDIA_ERR_SRC_NOT_SUPPORTED (4): file không có hoặc không phải MP3 hợp lệ → coi như chưa có nhạc
  t.status = el?.error?.code === 4 ? 'missing' : 'error'
}

const togglePlay = async (t: Track) => {
  const el = audioEls[t.id]
  if (!el || t.status !== 'ready') return
  if (!el.paused) { el.pause(); return }
  if (el.ended) el.currentTime = 0
  t.buffering = true
  try {
    await el.play()
  } catch (err: any) {
    t.buffering = false
    if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') return
    t.status = err?.name === 'NotSupportedError' ? 'missing' : 'error'
  }
}

const stopAll = () => {
  for (const t of tracks) {
    audioEls[t.id]?.pause()
    t.playing = false
    t.buffering = false
  }
}

watch(() => props.show, (open) => {
  if (!open) {
    stopAll()
    // Trình phát được tạo lại mỗi lần mở popup nên vị trí phát về 0; số giây đã nghe vẫn giữ trong phiên
    for (const t of tracks) { t.currentTime = 0; t.lastTime = 0 }
    return
  }
  for (const t of tracks) if (t.status !== 'ready') checkTrack(t)
}, { immediate: true })

onBeforeUnmount(stopAll)

const close = () => {
  if (submitting.value) return
  stopAll()
  emit('close')
}

const submitVote = async () => {
  if (!canSubmit.value) return
  const user = auth.currentUser
  if (!user) {
    stopAll()
    emit('close')
    router.push('/login')
    return
  }

  submitting.value = true
  try {
    // 1 lần/tài khoản: kiểm tra lại trên Firestore giống SubmitReportView (myReports chỉ có 50 đơn gần nhất)
    const snap = await getDocs(query(collection(db, 'reports'), where('uid', '==', user.uid), where('jobId', '==', MUSIC_VOTE_JOB_ID)))
    const statuses = snap.docs.map(d => d.data().status)
    if (statuses.some(s => s === 'approved' || s === 'collected')) {
      Swal.fire({ icon: 'error', title: 'ĐÃ NHẬN THƯỞNG!', text: 'Mỗi tài khoản chỉ được làm công việc này 1 lần duy nhất.', confirmButtonColor: '#dc2626' })
      return
    }
    if (statuses.includes('pending')) {
      Swal.fire({ icon: 'warning', title: 'ĐANG CHỜ DUYỆT!', text: 'Bạn đã gửi đánh giá cho công việc này rồi, vui lòng chờ Admin duyệt.', confirmButtonColor: '#f59e0b' })
      return
    }

    const userSnap = await getDoc(doc(db, 'users', user.uid))
    const userDoc: any = userSnap.exists() ? userSnap.data() : {}
    const listenedSeconds = (id: TrackId) => Math.round(tracks.find(t => t.id === id)?.listened ?? 0)

    // Đơn 'pending' giống SurveyView — Admin xem musicChoice ở cột BẰNG CHỨNG rồi duyệt/cộng xu như job cơ bản khác
    await addDoc(collection(db, 'reports'), {
      uid: user.uid,
      username: userDoc.username || '',
      fullName: userDoc.fullName || '',
      phoneRef: userDoc.phoneRef || userDoc.phone || '',
      jobId: MUSIC_VOTE_JOB_ID,
      jobName: jobConfig.value?.title || staticJob.title,
      reward: rewardAmount.value,
      musicChoice: choice.value,
      // Đo phía trình duyệt, có thể bị can thiệp — chỉ để Admin tham khảo, không phải bằng chứng tuyệt đối
      musicListenSeconds: { A: listenedSeconds('A'), B: listenedSeconds('B') },
      status: 'pending',
      createdAt: serverTimestamp(),
      site: 'rapjob'
    })

    stopAll()
    submittedChoice.value = choice.value
    showSuccess.value = true
  } catch (error: any) {
    alert('❌ LỖI HỆ THỐNG: ' + (error?.message || 'Vui lòng thử lại!'))
  } finally {
    submitting.value = false
  }
}

const finishSuccess = () => {
  showSuccess.value = false
  choice.value = null
  for (const t of tracks) { t.listened = 0; t.currentTime = 0; t.lastTime = 0 }
  emit('close')
}

const fmtTime = (s: number) => {
  const sec = Number.isFinite(s) && s > 0 ? Math.floor(s) : 0
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}
const progressPct = (t: Track) => t.duration > 0 ? Math.min(100, (t.currentTime / t.duration) * 100) : 0
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[5200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/85 backdrop-blur-sm" @click="close"></div>

      <div class="relative w-full max-w-md max-h-full overflow-y-auto overscroll-contain rounded-[28px] border border-red-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] p-4 min-[375px]:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-left">
        <button @click="close" aria-label="Đóng" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 text-slate-300 flex items-center justify-center active:scale-90 transition-transform">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <!-- Tiêu đề + thưởng + mô tả -->
        <div class="pr-10">
          <h2 class="text-white text-[18px] min-[375px]:text-[19px] leading-tight uppercase">🎧 {{ jobConfig?.title }}</h2>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <span class="px-2.5 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-[11.5px] font-black">Thưởng: {{ rewardText }}</span>
            <span class="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[11.5px] font-bold">Chỉ làm 1 lần</span>
          </div>
        </div>
        <p class="mt-2.5 text-slate-300 text-[13.5px] font-medium leading-relaxed">{{ jobConfig?.shortDesc }}</p>

        <!-- Đã gửi đánh giá (đang chờ / đã duyệt) -->
        <div v-if="activeReport" class="mt-4 rounded-2xl border p-4"
             :class="activeReport.status === 'pending' ? 'border-yellow-500/30 bg-yellow-500/10' : 'border-emerald-500/30 bg-emerald-500/10'">
          <p class="text-[14.5px] font-black leading-snug" :class="activeReport.status === 'pending' ? 'text-yellow-300' : 'text-emerald-300'">
            {{ activeReport.status === 'pending' ? '⏳ Đánh giá của bạn đang chờ Admin duyệt' : '✅ Bạn đã hoàn thành công việc này' }}
          </p>
          <p v-if="activeReport.musicChoice" class="mt-1.5 text-slate-300 text-[13px] font-medium">
            Lựa chọn của bạn: <span class="text-white font-black">Đoạn nhạc {{ activeReport.musicChoice }}</span>
          </p>
          <p class="mt-1 text-slate-400 text-[12px] font-medium">Mỗi tài khoản chỉ được gửi đánh giá 1 lần.</p>
        </div>

        <template v-else>
          <p v-if="lastRejected" class="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-rose-300 text-[12.5px] font-semibold leading-snug">
            Đơn trước bị từ chối<template v-if="lastRejected.note">: {{ lastRejected.note }}</template>. Bạn có thể nghe lại và gửi đánh giá mới.
          </p>

          <p class="mt-3 text-slate-400 text-[12.5px] font-medium leading-snug">
            Nghe ít nhất {{ minListenSeconds }} giây mỗi đoạn (đoạn ngắn hơn thì nghe hết) để mở khóa phần bình chọn.
          </p>

          <!-- 2 trình phát A / B -->
          <div class="mt-3 space-y-2.5">
            <div v-for="t in tracks" :key="t.id" class="rounded-2xl border p-3.5 transition-colors"
                 :class="t.playing ? 'border-red-500/60 bg-red-500/[0.08] shadow-[0_0_18px_rgba(220,38,38,0.25)]' : 'border-white/10 bg-black/30'">
              <div class="flex items-center justify-between gap-2">
                <p class="text-white text-[14.5px] font-black uppercase tracking-tight">🎵 {{ t.label }}</p>
                <span v-if="t.status === 'ready'" class="shrink-0 text-[11.5px] font-bold" :class="isDone(t) ? 'text-emerald-400' : 'text-slate-400'">
                  {{ isDone(t) ? '✓ Đã nghe đủ' : `Đã nghe ${Math.min(Math.floor(t.listened), requiredLabel(t))}/${requiredLabel(t)} giây` }}
                </span>
              </div>

              <div v-if="t.status === 'checking'" class="mt-3 flex items-center gap-2 text-slate-400 text-[12.5px] font-medium">
                <span class="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                Đang tải nhạc...
              </div>

              <div v-else-if="t.status === 'missing' || t.status === 'error'" class="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                <p class="text-amber-300 text-[12.5px] font-semibold leading-snug">
                  {{ t.status === 'missing' ? '🔇 Chưa có nhạc — đoạn nhạc đang được cập nhật.' : '⚠️ Không tải được đoạn nhạc, kiểm tra mạng rồi thử lại.' }}
                </p>
                <button @click="checkTrack(t)" class="shrink-0 px-3 py-2 rounded-lg bg-white/10 text-white text-[11.5px] font-bold active:scale-95 transition-transform">Thử lại</button>
              </div>

              <template v-else>
                <div class="mt-3 flex items-center gap-3">
                  <button @click="togglePlay(t)" :aria-label="`${t.playing ? 'Tạm dừng' : 'Phát'} ${t.label}`"
                          class="w-12 h-12 shrink-0 rounded-full bg-red-600 active:bg-red-500 text-white flex items-center justify-center shadow-[0_4px_16px_rgba(220,38,38,0.45)] active:scale-95 transition-transform">
                    <span v-if="t.buffering" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <svg v-else-if="t.playing" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
                    <svg v-else class="w-5 h-5 translate-x-[1px]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z"/></svg>
                  </button>
                  <div class="flex-1 min-w-0">
                    <div class="h-2 rounded-full bg-white/10 overflow-hidden" role="progressbar" :aria-label="`Tiến trình ${t.label}`"
                         aria-valuemin="0" :aria-valuemax="Math.round(t.duration)" :aria-valuenow="Math.round(t.currentTime)">
                      <div class="h-full rounded-full bg-gradient-to-r from-red-500 to-yellow-400" :style="{ width: progressPct(t) + '%' }"></div>
                    </div>
                    <div class="mt-1.5 flex justify-between text-[11.5px] font-semibold tabular-nums text-slate-400">
                      <span>{{ fmtTime(t.currentTime) }}</span>
                      <span>{{ t.duration ? fmtTime(t.duration) : '--:--' }}</span>
                    </div>
                  </div>
                </div>
                <audio :ref="(el) => setAudioEl(t.id, el)" :src="t.src" preload="metadata"
                       @loadedmetadata="onMeta(t)" @durationchange="onMeta(t)" @timeupdate="onTimeUpdate(t)"
                       @play="onPlay(t)" @playing="t.buffering = false" @waiting="t.buffering = true"
                       @pause="onPause(t)" @ended="onEnded(t)" @error="onError(t)"></audio>
              </template>
            </div>
          </div>

          <!-- Bình chọn A / B -->
          <div class="mt-4">
            <p class="text-white text-[15.5px] font-black">Bạn thích đoạn nhạc nào hơn?</p>
            <div class="mt-2.5 grid grid-cols-2 gap-2.5">
              <button v-for="t in tracks" :key="t.id" @click="choose(t.id)" :disabled="!canChoose" :aria-pressed="choice === t.id"
                      class="h-14 rounded-2xl border-2 text-[14.5px] font-black flex items-center justify-center gap-1.5 transition-all"
                      :class="choice === t.id
                        ? 'bg-red-600 border-yellow-400 text-white shadow-[0_0_20px_rgba(220,38,38,0.45)]'
                        : canChoose
                          ? 'bg-white/[0.04] border-white/15 text-white active:scale-[0.98]'
                          : 'bg-white/[0.02] border-white/5 text-slate-500 cursor-not-allowed'">
                <span v-if="choice === t.id">✓</span>
                <span v-else-if="!canChoose">🔒</span>
                Đoạn nhạc {{ t.id }}
              </button>
            </div>
            <p class="mt-2 text-[12.5px] font-semibold" :class="choice ? 'text-yellow-400' : musicUnavailable ? 'text-amber-300' : 'text-slate-400'">
              {{ choiceHint }}
            </p>
          </div>

          <button @click="submitVote" :disabled="!canSubmit"
                  class="mt-4 w-full h-12 rounded-xl text-[14px] font-black uppercase tracking-wide transition-transform"
                  :class="canSubmit
                    ? 'bg-gradient-to-r from-yellow-300 to-amber-400 text-[#3a0a00] shadow-[0_4px_16px_rgba(251,191,36,0.35)] active:scale-[0.98]'
                    : 'bg-slate-700/70 text-slate-400 cursor-not-allowed'">
            {{ submitting ? 'ĐANG GỬI...' : 'GỬI ĐÁNH GIÁ' }}
          </button>
          <p class="mt-2 text-center text-slate-500 text-[11.5px] font-medium">Không cần ảnh bằng chứng · Xu được cộng sau khi Admin duyệt</p>
        </template>
      </div>

      <!-- Gửi thành công — đơn chờ Admin duyệt -->
      <div v-if="showSuccess" class="fixed inset-0 z-[5600] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="finishSuccess"></div>
        <div class="relative w-full max-w-sm rounded-[28px] border border-emerald-500/30 bg-gradient-to-b from-[#1f1210] to-[#120b0a] p-6 text-center shadow-2xl">
          <div class="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl">✅</div>
          <h3 class="mt-4 text-white text-[18px] leading-tight uppercase">Gửi đánh giá thành công</h3>
          <p class="mt-2 text-slate-400 text-[13px] font-medium leading-relaxed">
            Bạn đã chọn <span class="text-white font-black">Đoạn nhạc {{ submittedChoice }}</span>. Đơn đang
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
