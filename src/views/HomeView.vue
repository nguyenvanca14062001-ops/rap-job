<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '@/firebase'
import { onAuthStateChanged, signOut } from "firebase/auth"
import Swal from 'sweetalert2'

import Sidebar from '@/components/home/Sidebar.vue'
import JobSection from '@/components/home/JobSection.vue'
import HistorySection from '@/components/home/HistorySection.vue'
import InfoSection from '@/components/home/InfoSection.vue'

const router = useRouter()
const isLoggedIn = ref(false)
const isMenuOpen = ref(false)
const showBankModal = ref(false)
const isDataLoading = ref(true)

const username = ref(localStorage.getItem('mmo_username') || 'Member')
const userBalance = ref(Number(localStorage.getItem('mmo_balance')) || 0)
const totalWithdrawn = ref(0) 

const myReports = ref<any[]>([])
const myWithdrawals = ref<any[]>([])

const formatAmount = (val: any) => {
  if (!val) return '0';
  const cleanNum = String(val).replace(/\D/g, ''); 
  return Number(cleanNum).toLocaleString();
};

const combinedHistory = computed(() => {
  const combined = [
    ...myReports.value.map(item => ({ ...item, type: 'task' })),
    ...myWithdrawals.value.map(item => ({ ...item, type: 'withdraw' }))
  ]
  return combined.map(item => {
    let displayTime = 'VỪA XONG'
    let sortTime = Date.now()
    if (item.createdAt) {
      if (typeof item.createdAt === 'string') {
        displayTime = item.createdAt.split('T')[0]
        sortTime = new Date(item.createdAt).getTime()
      } else if (item.createdAt.toDate) {
        const d = item.createdAt.toDate()
        displayTime = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`
        sortTime = d.getTime()
      }
    }
    return { ...item, displayTime, sortTime }
  }).sort((a, b) => b.sortTime - a.sortTime)
})

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      isLoggedIn.value = true
      isDataLoading.value = false
    } else {
      isLoggedIn.value = false
      isDataLoading.value = false
      username.value = 'Member'
      userBalance.value = 0
      myReports.value = []
      myWithdrawals.value = []
    }
  })
})

const handleNav = (path: string) => {
  router.push(path);
  isMenuOpen.value = false;
}

const handleScrollToHistory = () => {
  isMenuOpen.value = false
  setTimeout(() => {
    const el = document.getElementById('history-section')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, 150)
}

const handleQuickJob = () => {
  const el = document.querySelector('main section:nth-child(2)'); 
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ============================================================================
// HÀM KIỂM TRA ĐỘ TUỔI KHỚP KHÍT 100% THEO FILE JOBS.TS CỦA BOSS
// ============================================================================
const checkJobAgeLimit = (jobId: string, callback: () => void) => {
  const age18Jobs = ['msb-bank', 'vpbank', 'tpbank', 'app-chung-khoan', 'app-chung-khoan-2'];
  const age20Jobs = ['app-chung-khoan-3'];

  // Nếu không phải ô job cần lọc tuổi thì cho nhảy thẳng vào hướng dẫn
  if (!age18Jobs.includes(jobId) && !age20Jobs.includes(jobId)) {
    callback();
    return;
  }

  let ageLimit = age18Jobs.includes(jobId) ? '18' : '20';
  let appType = jobId.includes('bank') ? 'Ngân hàng' : 'Ứng dụng Chứng khoán';

  const hasSeenPopup = localStorage.getItem(`seen_age_popup_${jobId}`);

  if (!hasSeenPopup) {
    Swal.fire({
      title: '⚠️ LƯU Ý ĐỘ TUỔI ĐĂNG KÝ',
      html: `<div class="text-left font-sans normal-case text-slate-300 text-sm leading-relaxed">
              Chiến dịch <span class="text-yellow-400 font-black italic">${appType}</span> này yêu cầu bắt buộc bạn phải từ <span class="text-rose-400 font-black text-base">${ageLimit} tuổi trở lên</span> mới đủ điều kiện đăng ký mở tài khoản.<br/><br/>
              👉 <span class="text-emerald-400 font-bold">Mẹo kiếm tiền:</span> Nếu bạn chưa đủ tuổi, bạn hoàn toàn có thể <span class="text-white font-bold">nhờ người thân hoặc bạn bè đủ tuổi đăng ký hộ</span>, sau đó chụp lại bằng chứng nộp lên hệ thống để nhận hoa hồng bình thường nhé!
             </div>`,
      icon: 'warning',
      background: '#111726',
      color: '#ffffff',
      confirmButtonText: 'ĐÃ HIỂU VÀ TIẾP TỤC',
      confirmButtonColor: '#2563eb',
      allowOutsideClick: false,
      customClass: {
        popup: 'rounded-[30px] border border-slate-800 shadow-2xl',
        title: 'text-lg font-black tracking-wide text-white font-sans'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.setItem(`seen_age_popup_${jobId}`, 'true');
        callback();
      }
    });
  } else {
    callback();
  }
}

const executeJobNavigation = (jobId: string) => {
  if (!isLoggedIn.value) { router.push('/login'); return; }
  router.push(`/job/${jobId}`);
}

const handleReceiveJob = (jobId: string) => {
  if (!isLoggedIn.value) { router.push('/login'); return; }

  // Nếu click vào mục lớn "APP NGÂN HÀNG" trên menu điều hướng mobile/sidebar
  if (jobId === 'APP NGÂN HÀNG' || jobId === 'app-ngan-hang') {
    showBankModal.value = true;
    return;
  }

  // Click trực tiếp từ danh sách các ô card ngoài trang chủ
  checkJobAgeLimit(jobId, () => {
    executeJobNavigation(jobId);
  });
}

const contactSupport = () => {
  window.open('https://facebook.com/trungtammmo.pro', '_blank')
}

const logout = async () => { 
  if(confirm('Bạn có chắc chắn muốn đăng xuất?')) { 
    await signOut(auth); localStorage.clear(); router.push('/login'); 
  } 
}
</script>

<template>
  <div class="min-h-screen bg-[#090e17] text-slate-300 font-sans flex flex-col overflow-x-hidden text-left uppercase italic font-black relative pb-32 lg:pb-0">
    
    <header class="fixed top-0 left-0 right-0 h-16 bg-[#111726]/95 backdrop-blur-xl border-b border-slate-800/50 z-[100] flex lg:hidden items-center justify-between px-6">
      <button @click="isMenuOpen = !isMenuOpen" class="text-white text-2xl p-2 -ml-2 font-sans italic">☰</button>
      <div class="text-white font-black tracking-tighter uppercase text-sm">MMO <span class="text-blue-500">PRO</span></div>
      
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 bg-[#1a233a] border border-slate-700/50 pl-3 pr-1 py-1 rounded-full shadow-inner">
          <svg class="w-4 h-4 drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="url(#headerGoldGradient)" />
            <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
            <defs>
              <linearGradient id="headerGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#fde047" />
                <stop offset="50%" style="stop-color:#eab308" />
                <stop offset="100%" style="stop-color:#854d0e" />
              </linearGradient>
            </defs>
          </svg>

          <span class="text-white text-[11px] font-black tracking-tight leading-none font-sans">
            {{ isLoggedIn ? formatAmount(userBalance) : '0' }} <span class="text-yellow-500 text-[9px] font-bold">XU</span>
          </span>

          <button @click="!isLoggedIn ? router.push('/login') : handleQuickJob()" class="w-6 h-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15" /></svg>
          </button>
        </div>
      </div>
    </header>

    <div class="flex flex-1">
      <Sidebar 
        :isLoggedIn="isLoggedIn" :isMenuOpen="isMenuOpen" :username="username" :userBalance="userBalance"
        @toggleMenu="isMenuOpen = !isMenuOpen" @logout="logout" @routerPush="(p) => router.push(p)"
        @requireAuth="(p) => router.push(p)" @scrollToHistory="handleScrollToHistory" @contactSupport="contactSupport"
      />

      <main class="flex-1 min-w-0 px-4 md:px-10 pb-10 pt-20 lg:pt-10 space-y-10">
        <JobSection 
          :username="username" :isLoggedIn="isLoggedIn" :userBalance="userBalance" :totalWithdrawn="totalWithdrawn"
          @receiveJob="handleReceiveJob" @contactSupport="contactSupport" @routerPush="(p) => router.push(p)"
        />
        <HistorySection id="history-section" :isLoggedIn="isLoggedIn" :isDataLoading="isDataLoading" :myReports="combinedHistory" />
        <InfoSection @contactSupport="contactSupport" />
      </main>
    </div>

    <div v-if="showBankModal" class="fixed inset-0 z-[5000] flex items-end lg:items-center justify-center">
      <div @click="showBankModal = false" class="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity"></div>
      
      <div class="relative w-full lg:max-w-md bg-[#111726] border-t lg:border border-slate-800 rounded-t-[40px] lg:rounded-[35px] p-8 md:p-10 shadow-[0_-20px_60px_rgba(0,0,0,0.8)]">
        <div class="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-6 lg:hidden"></div>
        <h3 class="text-xl text-white border-l-4 border-blue-600 pl-4 mb-8 font-black uppercase italic tracking-tighter">Chọn Ngân Hàng</h3>
        
        <div class="space-y-4 font-bold uppercase italic font-black pb-10 lg:pb-0">
          <div v-for="bank in [{ id: 'msb-bank', name: 'MSB' }, { id: 'vpbank', name: 'VPBank' }, { id: 'tpbank', name: 'TPBank' }]" 
            :key="bank.id" @click="checkJobAgeLimit(bank.id, () => { showBankModal = false; executeJobNavigation(bank.id) })"
            class="flex items-center justify-between p-6 bg-[#0d121f] border border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500 transition-all active:scale-95 shadow-lg"
          >
             <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-blue-500 text-xs border border-slate-800">🏦</div>
              <span class="text-white text-sm tracking-tighter">{{ bank.name }}</span>
            </div>
            <span class="text-blue-500 font-black font-sans italic">➜</span>
          </div>
          <button @click="showBankModal = false" class="w-full py-4 mt-4 bg-slate-900 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest lg:hidden">ĐÓNG LẠI</button>
        </div>
      </div>
    </div>

    <nav class="fixed bottom-0 left-0 w-full bg-[#090e17]/95 backdrop-blur-2xl border-t border-slate-800/80 z-[4000] flex lg:hidden justify-around items-end px-2 pb-7 pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
       <button @click="handleNav('/')" class="flex flex-col items-center gap-1.5 text-blue-500 active:scale-90">
         <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3l10 9h-3v9h-14v-9h-3z"/></svg>
         <span class="text-[8px] font-black tracking-widest">TRANG CHỦ</span>
       </button>
       
       <button @click="handleScrollToHistory()" class="flex flex-col items-center gap-1.5 text-slate-500 active:scale-90">
         <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
         <span class="text-[8px] font-black tracking-widest">LỊCH SỬ</span>
       </button>
       
       <button @click="handleNav('/withdraw')" class="relative -top-5 flex flex-col items-center group">
         <div class="w-16 h-16 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-full flex items-center justify-center text-white shadow-[0_10px_30px_rgba(37,99,235,0.6)] border-[5px] border-[#090e17] group-active:scale-90 transition-transform">
           <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
         </div>
         <span class="text-[9px] font-black text-blue-400 mt-1 tracking-widest uppercase">Rút Xu</span>
       </button>
       
       <button @click="handleNav('/submit-report')" class="flex flex-col items-center gap-1.5 text-slate-500 active:scale-90">
         <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
         <span class="text-[8px] font-black tracking-widest">BÁO CÁO</span>
       </button>

       <button @click="isMenuOpen = true" class="flex flex-col items-center gap-1.5 text-slate-500 active:scale-90">
         <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
         <span class="text-[8px] font-black tracking-widest">MENU</span>
       </button>
    </nav>

  </div>
</template>

<style scoped>
</style>