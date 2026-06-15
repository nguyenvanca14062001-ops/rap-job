<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/firebase'
import { doc, updateDoc, increment, serverTimestamp, collection, addDoc, query, where, getDocs } from 'firebase/firestore'

const router = useRouter()

const SURVEY_ID = 'survey-cinema'
const REWARD = 20000

const questions = [
  {
    id: 1,
    question: 'Bạn thường xem phim ở rạp nào nhất?',
    options: ['CGV', 'Lotte Cinema', 'BHD Star', 'Galaxy Cinema']
  },
  {
    id: 2,
    question: 'Bạn xem bao nhiêu phim mỗi tháng?',
    options: ['1-2 phim', '3-5 phim', '6+ phim', 'Rất hiếm khi']
  },
  {
    id: 3,
    question: 'Thể loại phim yêu thích của bạn?',
    options: ['Hành động', 'Tình cảm', 'Hài hước', 'Kinh dị', 'Hoạt hình']
  },
  {
    id: 4,
    question: 'Khung giờ bạn thường xem phim?',
    options: ['Buổi sáng', 'Buổi trưa', 'Buổi tối', 'Khuya']
  },
  {
    id: 5,
    question: 'Bạn thường đi xem phim cùng ai?',
    options: ['Một mình', 'Người yêu/vợ chồng', 'Gia đình', 'Bạn bè']
  }
]

const currentQuestion = ref(0)
const answers = ref<string[]>([])
const submitting = ref(false)
const done = ref(false)
const alreadyDone = ref(false)
const checking = ref(true)

const progress = computed(() => (currentQuestion.value / questions.length) * 100)

onMounted(async () => {
  await auth.authStateReady()   // Đợi Firebase restore auth session trước khi check
  const user = auth.currentUser
  if (!user) {
    router.push('/login')
    return
  }

  try {
    // Kiểm tra đã làm chưa bằng cách query reports collection (tránh cần rules mới)
    const q = query(
      collection(db, 'reports'),
      where('uid', '==', user.uid),
      where('jobId', '==', SURVEY_ID)
    )
    const snap = await getDocs(q)
    if (!snap.empty) {
      alreadyDone.value = true
    }
  } catch (e) {
    // ignore — still allow survey if check fails
  } finally {
    checking.value = false
  }
})

const selectAnswer = async (option: string) => {
  if (submitting.value) return
  answers.value[currentQuestion.value] = option

  if (currentQuestion.value < questions.length - 1) {
    currentQuestion.value++
  } else {
    await submitSurvey()
  }
}

const submitSurvey = async () => {
  submitting.value = true
  const user = auth.currentUser
  if (!user) { router.push('/login'); return }

  try {
    // 1. Cộng xu vào ví
    await updateDoc(doc(db, 'users', user.uid), {
      balance: increment(REWARD)
    })

    // 2. Ghi vào reports — vừa hiện trong lịch sử, vừa dùng để kiểm tra one-time
    //    Kết quả khảo sát lưu trong field surveyAnswers để admin có thể xem
    await addDoc(collection(db, 'reports'), {
      uid: user.uid,
      jobId: SURVEY_ID,
      jobName: 'KHẢO SÁT THÓI QUEN XEM PHIM',
      reward: REWARD,
      status: 'approved',
      surveyAnswers: answers.value.map((ans, i) => ({
        question: questions[i].question,
        answer: ans
      })),
      createdAt: serverTimestamp(),
      site: 'rapjob'
    })

    done.value = true
  } catch (e: any) {
    alert('Có lỗi xảy ra: ' + (e?.message || 'Vui lòng thử lại!'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#0e0a09] flex flex-col items-center justify-center p-4 font-black italic uppercase">

    <!-- SVG gradient defs -->
    <svg width="0" height="0" class="absolute">
      <defs>
        <linearGradient id="surveyGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fde047" />
          <stop offset="50%" style="stop-color:#eab308" />
          <stop offset="100%" style="stop-color:#854d0e" />
        </linearGradient>
      </defs>
    </svg>

    <!-- Đang kiểm tra -->
    <div v-if="checking" class="text-center">
      <div class="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-slate-500 text-[10px] tracking-[3px]">Đang kiểm tra...</p>
    </div>

    <!-- Đã làm rồi -->
    <div v-else-if="alreadyDone" class="w-full max-w-md text-center space-y-6">
      <div class="text-6xl mb-4">✅</div>
      <h2 class="text-2xl text-white tracking-tighter">ĐÃ HOÀN THÀNH</h2>
      <p class="text-slate-400 text-sm normal-case font-bold not-italic px-4">
        Bạn đã tham gia khảo sát này rồi. Mỗi khảo sát chỉ được làm một lần.
      </p>
      <button @click="router.push('/')"
        class="w-full bg-gradient-to-r from-violet-700 to-purple-600 text-white py-5 rounded-[20px] text-sm shadow-lg active:scale-95 transition-all">
        VỀ TRANG CHỦ ➔
      </button>
    </div>

    <!-- Màn hình kết quả -->
    <div v-else-if="done" class="w-full max-w-md text-center space-y-6 animate-in fade-in duration-500">
      <div class="text-7xl mb-2 animate-bounce">🎬</div>
      <h2 class="text-3xl text-white tracking-tighter">CẢM ƠN BẠN!</h2>
      <div class="bg-[#1a0f2e] border border-violet-700/40 rounded-[25px] p-7 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
        <p class="text-slate-400 text-[10px] tracking-widest mb-4">PHẦN THƯỞNG ĐÃ VÀO VÍ</p>
        <div class="flex items-center justify-center gap-3">
          <span class="text-4xl font-black text-violet-400 tracking-tighter">+30.000</span>
          <div class="flex flex-col items-center">
            <svg class="w-7 h-7 drop-shadow-[0_0_8px_rgba(234,179,8,0.7)]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="url(#surveyGoldGrad)" />
              <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span class="text-[9px] text-yellow-500 font-black not-italic leading-none">XU</span>
          </div>
        </div>
      </div>
      <p class="text-slate-500 text-[10px] tracking-widest normal-case not-italic">Phản hồi của bạn đã được ghi nhận thành công.</p>
      <button @click="router.push('/')"
        class="w-full bg-gradient-to-r from-violet-700 to-purple-600 text-white py-5 rounded-[20px] text-sm shadow-[0_0_20px_rgba(139,92,246,0.4)] active:scale-95 transition-all">
        VỀ TRANG CHỦ ➔
      </button>
    </div>

    <!-- Form khảo sát -->
    <div v-else class="w-full max-w-lg space-y-6">

      <!-- Header -->
      <div class="flex items-center gap-4">
        <button @click="router.push('/')"
          class="w-10 h-10 rounded-xl bg-[#1a0f2e] border border-violet-700/30 flex items-center justify-center text-violet-400 hover:bg-violet-700/20 transition-all active:scale-90 text-lg">
          ←
        </button>
        <div>
          <h1 class="text-lg text-white tracking-tighter leading-none">KHẢO SÁT PHIM</h1>
          <p class="text-violet-400 text-[10px] tracking-widest normal-case font-bold not-italic mt-0.5">Trả lời để nhận 30.000 xu</p>
        </div>
      </div>

      <!-- Progress -->
      <div class="space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-slate-500 text-[10px] tracking-widest">TIẾN TRÌNH</span>
          <span class="text-violet-400 text-[11px] tracking-widest">CÂU {{ currentQuestion + 1 }}/{{ questions.length }}</span>
        </div>
        <div class="h-2 bg-[#1a0f2e] rounded-full overflow-hidden border border-violet-900/40">
          <div class="h-full bg-gradient-to-r from-violet-600 to-purple-500 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(139,92,246,0.6)]"
               :style="{ width: progress + '%' }"></div>
        </div>
      </div>

      <!-- Question card -->
      <div class="bg-[#150f0d] border border-violet-700/30 rounded-[28px] p-6 md:p-8 shadow-[0_0_40px_rgba(139,92,246,0.1)] space-y-6">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-xl bg-violet-700/20 border border-violet-600/30 flex items-center justify-center text-violet-400 text-sm shrink-0 mt-0.5">
            {{ currentQuestion + 1 }}
          </div>
          <h2 class="text-white text-base md:text-lg leading-snug tracking-tight normal-case not-italic font-black">
            {{ questions[currentQuestion].question }}
          </h2>
        </div>

        <!-- Options -->
        <div class="space-y-3">
          <button
            v-for="option in questions[currentQuestion].options"
            :key="option"
            @click="selectAnswer(option)"
            :disabled="submitting"
            class="w-full text-left px-5 py-4 rounded-[18px] bg-[#1a0f2e] border border-violet-800/40 hover:border-violet-500/70 hover:bg-violet-700/15 text-slate-300 hover:text-white text-sm normal-case font-bold not-italic transition-all duration-200 active:scale-[0.98] disabled:opacity-50 group">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full border-2 border-violet-600/50 group-hover:border-violet-400 group-hover:bg-violet-500 transition-all shrink-0"></div>
              {{ option }}
            </div>
          </button>
        </div>
      </div>

      <!-- Loading submit -->
      <div v-if="submitting" class="text-center py-4">
        <div class="w-6 h-6 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p class="text-slate-500 text-[10px] tracking-[3px]">Đang ghi nhận kết quả...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.normal-case { text-transform: none; }
.not-italic { font-style: normal; }
@keyframes spin {
  to { transform: rotate(360deg); }
}
.animate-spin { animation: spin 0.8s linear infinite; }
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
.animate-bounce { animation: bounce 1s ease-in-out infinite; }
</style>
