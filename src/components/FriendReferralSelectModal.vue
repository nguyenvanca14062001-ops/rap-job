<script setup lang="ts">
import { computed, watchEffect } from 'vue'

const props = defineProps<{ show: boolean; vipJobs?: any[] }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'selectMomo'): void
  (e: 'selectAbbank'): void
  (e: 'selectShopeePay'): void
  (e: 'selectLpbankPlus'): void
}>()

// 4 doc CỐ ĐỊNH trong Firestore vip_jobs — Admin luôn sửa đúng 4 ID này, popup luôn đọc đúng 4 ID này.
// Không hard-code title/subtitle/reward/status ở đây, chỉ những gì Firestore không lưu
// (icon hiển thị, hành động điều hướng khi bấm "CHỌN CÔNG VIỆC").
const REFERRAL_JOB_IDS = ['referral_momo', 'referral_abbank', 'referral_shopee_pay', 'referral_lpbank_plus'] as const
type ReferralJobId = typeof REFERRAL_JOB_IDS[number]

const UI_ONLY: Record<ReferralJobId, { icon: string; select: () => void }> = {
  referral_momo: { icon: '💰', select: () => emit('selectMomo') },
  referral_abbank: { icon: '🏦', select: () => emit('selectAbbank') },
  referral_shopee_pay: { icon: '🛍️', select: () => emit('selectShopeePay') },
  referral_lpbank_plus: { icon: '🏦', select: () => emit('selectLpbankPlus') },
}

// Giá trị mặc định — CHỈ dùng khi Firestore CHƯA có doc tương ứng (vd mới deploy, chưa seed).
// Ngay khi vip_jobs/<id> tồn tại, toàn bộ text/reward/status phải lấy từ Firestore, tuyệt đối
// không dùng các giá trị này ghi đè lên dữ liệu Firestore đã tải được.
const DEFAULTS: Record<ReferralJobId, { name: string; subtitle: string; rewardText: string }> = {
  referral_momo: {
    name: 'Giới thiệu bạn bè đăng ký Ví MoMo',
    subtitle: 'Mời bạn bè đăng ký APP VÍ MOMO',
    rewardText: '65.000 XU',
  },
  referral_abbank: {
    name: 'Giới thiệu bạn bè đăng ký APP ABBANK',
    subtitle: 'Mời bạn bè đăng ký APP ABBANK nhận 85.000 xu/lần',
    rewardText: '85.000 XU',
  },
  referral_shopee_pay: {
    name: 'Giới thiệu bạn bè đăng ký APP SHOPEE PAY',
    subtitle: 'Mời bạn bè đăng ký APP SHOPEE PAY nhận 90.000 xu/lượt',
    rewardText: '90.000 XU',
  },
  referral_lpbank_plus: {
    name: 'Giới thiệu bạn bè đăng ký APP LPBANK PLUS',
    subtitle: 'Mời bạn bè đăng ký APP LPBANK PLUS nhận 85.000 xu/lượt',
    rewardText: '85.000 XU',
  },
}

// Doc ID cũ (vip_jobs/referral-hub) từng trùng tiêu đề "GIỚI THIỆU BẠN BÈ ABBANK" nhưng sai jobId.
// Đây là cầu nối TẠM THỜI cho tới khi Admin mở tab "CẤU HÌNH JOB VIP" một lần để tự động gộp sang
// vip_jobs/referral_abbank (xem migrateLegacyAbbankDocIfNeeded trong AdminView.vue). Ngay khi
// vip_jobs/referral_abbank tồn tại, nhánh fallback này không còn được dùng tới nữa.
const LEGACY_JOB_ALIASES: Record<string, string[]> = {
  referral_abbank: ['referral-hub'],
}

// Đọc trực tiếp đúng 3 doc cố định trong vip_jobs — không quét/gộp toàn bộ collection ngoài phạm vi này.
const findVipJobDoc = (id: string) => {
  const jobs = props.vipJobs || []
  const primary = jobs.find(v => (v.jobId || v.id) === id)
  if (primary) return primary
  for (const alias of LEGACY_JOB_ALIASES[id] || []) {
    const found = jobs.find(v => (v.jobId || v.id) === alias)
    if (found) return found
  }
  return undefined
}

type ReferralJob = { key: string; icon: string; name: string; subtitle: string; rewardText: string; status: string; select: () => void }

const formatRewardText = (cfg: any, fallback: string) => {
  if (cfg?.rewardText) return cfg.rewardText
  if (cfg?.reward) {
    const digits = String(cfg.reward).replace(/\D/g, '')
    return digits ? `${Number(digits).toLocaleString('vi-VN')} XU` : fallback
  }
  return fallback
}

const referralJobs = computed<ReferralJob[]>(() => REFERRAL_JOB_IDS.map(id => {
  const cfg = findVipJobDoc(id)
  const def = DEFAULTS[id]
  const ui = UI_ONLY[id]
  return {
    key: id,
    icon: ui.icon,
    name: cfg?.title || def.name,
    subtitle: cfg?.subtitle || def.subtitle,
    rewardText: formatRewardText(cfg, def.rewardText),
    status: cfg?.status || 'open',
    select: ui.select,
  }
}))

const visibleJobs = computed(() => referralJobs.value.filter(j => j.status !== 'hidden'))

const handleSelect = (job: ReferralJob) => {
  if (job.status === 'paused') {
    alert('⏸️ CÔNG VIỆC TẠM DỪNG\nChương trình đang được cập nhật. Vui lòng quay lại sau!')
    return
  }
  if (job.status === 'soldout') {
    alert('🚫 ĐÃ HẾT SUẤT\nChương trình đã hết suất nhận thưởng. Vui lòng quay lại sau!')
    return
  }
  job.select()
}

// Log debug tạm thời — xác nhận popup đọc đúng vip_jobs/referral_abbank. Xoá khi đã kiểm tra xong.
watchEffect(() => {
  if (!import.meta.env.DEV) return
  console.log('[Referral Popup] referralJobs loaded:', referralJobs.value)
  console.log('[Referral Popup] ABBANK config:', findVipJobDoc('referral_abbank'))
})
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-[5200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/90 backdrop-blur-md" @click="emit('close')"></div>

      <div class="relative bg-[#111726] border border-amber-500/30 w-full max-w-lg rounded-[36px] p-6 md:p-8 shadow-2xl max-h-[85vh] overflow-y-auto text-left font-black italic uppercase">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg md:text-xl text-white tracking-tight">👥 GIỚI THIỆU BẠN BÈ</h2>
          <button @click="emit('close')" class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 active:scale-90 transition-transform shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <p class="text-slate-400 text-[10px] font-medium normal-case leading-relaxed mb-6">
          Chọn app muốn giới thiệu để nhận thưởng.
        </p>

        <div class="space-y-3">
          <div v-for="job in visibleJobs" :key="job.key"
               class="bg-[#0d121f] border rounded-2xl p-4 flex items-center gap-3"
               :class="job.status === 'paused' || job.status === 'soldout' ? 'border-slate-700/60 opacity-60' : 'border-amber-500/30'">
            <div class="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-xl shrink-0">{{ job.icon }}</div>
            <div class="flex-1 min-w-0">
              <p class="text-white text-[12px] leading-snug">{{ job.name }}</p>
              <p class="text-slate-400 text-[9px] normal-case font-medium mt-0.5 leading-snug" v-if="job.subtitle">{{ job.subtitle }}</p>
              <p class="text-[#00df89] text-[11px] mt-1 flex items-center gap-1">
                <span class="text-[#f59e0b]">⚡</span> {{ job.rewardText }}
              </p>
            </div>
            <button v-if="job.status === 'paused'" disabled
                    class="shrink-0 bg-slate-800 text-slate-500 px-4 py-2.5 rounded-xl text-[10px] cursor-not-allowed">
              TẠM DỪNG
            </button>
            <button v-else-if="job.status === 'soldout'" disabled
                    class="shrink-0 bg-slate-800 text-slate-500 px-4 py-2.5 rounded-xl text-[10px] cursor-not-allowed">
              HẾT SUẤT
            </button>
            <button v-else @click="handleSelect(job)"
                    class="shrink-0 bg-amber-500 hover:bg-amber-400 text-amber-950 px-4 py-2.5 rounded-xl text-[10px] active:scale-95 transition-all shadow-lg">
              CHỌN CÔNG VIỆC
            </button>
          </div>

          <div v-if="!visibleJobs.length" class="text-center py-10">
            <div class="text-4xl mb-3">📭</div>
            <p class="text-slate-500 text-[11px] normal-case font-bold leading-relaxed">Hiện chưa có chương trình giới thiệu bạn bè nào đang mở.</p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
