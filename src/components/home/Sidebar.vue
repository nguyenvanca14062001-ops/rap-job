<script setup lang="ts">
/**
 * SIDEBAR COMPONENT - MMO PRO
 * HIỂN THỊ ĐẦY ĐỦ TRÊN PC - RÚT GỌN 4 JOB HOT TRÊN MOBILE
 */

defineProps<{ 
 isLoggedIn: boolean; 
 isMenuOpen: boolean; 
 username: string; 
 userBalance: number 
}>();

const emit = defineEmits([
 'toggleMenu', 
 'logout', 
 'routerPush', 
 'requireAuth', 
 'scrollToHistory', 
 'contactSupport'
]);

const handleHistoryClick = () => {
 emit('scrollToHistory');
}

const navigateTo = (path: string, authRequired = false) => {
 if (authRequired) {
   emit('requireAuth', path);
 } else {
   emit('routerPush', path);
 }
}
</script>

<template>
 <div v-if="isMenuOpen" @click="emit('toggleMenu')" class="fixed inset-0 bg-black/80 z-[110] lg:hidden backdrop-blur-sm"></div>

 <aside :class="[
   'fixed lg:sticky top-0 left-0 h-screen w-[260px] md:w-[280px] bg-gradient-to-b from-[#1c100c] to-[#120a08] border-r border-slate-900/50 flex flex-col transition-transform duration-300 z-[120] shadow-2xl lg:shadow-none overflow-y-auto selection:bg-red-700/30 font-black italic text-left uppercase',
   isMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
 ]">
   
   <svg width="0" height="0" class="absolute">
     <defs>
       <linearGradient id="sidebarGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
         <stop offset="0%" style="stop-color:#fde047" />
         <stop offset="50%" style="stop-color:#eab308" />
         <stop offset="100%" style="stop-color:#854d0e" />
       </linearGradient>
     </defs>
   </svg>

   <div class="py-5 px-4 flex flex-col items-center justify-center border-b border-slate-800/50 shrink-0">
     <div @click="navigateTo('/')" class="text-center cursor-pointer hover:scale-105 transition-transform">
       <h1 class="text-white text-3xl font-black tracking-tighter drop-shadow-[0_0_20px_rgba(185,28,28,0.6)]">
         RẠP <span class="text-red-500">JOB</span>
       </h1>
       <p class="text-[9px] text-slate-500 tracking-[4px] mt-0.5 font-bold">CINEMA HUB</p>
     </div>
   </div>

   <div class="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
     <div v-if="isLoggedIn" class="mb-4 px-2">
        <div class="bg-[#1c1009] border border-red-900/30 p-4 rounded-2xl shadow-inner flex items-center justify-between">
            <div class="flex flex-col">
                <span class="text-slate-500 text-[8px] tracking-widest font-bold">VÍ HIỆN TẠI</span>
                <div class="flex items-baseline gap-1 mt-1">
                    <span class="text-white text-xl font-black tracking-tighter">{{ userBalance.toLocaleString() }}</span>
                    <div class="flex flex-col items-center translate-y-[-2px]">
                        <svg class="w-4 h-4 drop-shadow-[0_0_5px_rgba(234,179,8,0.6)]" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" fill="url(#sidebarGoldGradient)" />
                            <path d="M12 7v10M9 10h6M9 14h6" stroke="#854d0e" stroke-width="2" stroke-linecap="round" />
                        </svg>
                        <span class="text-[7px] text-yellow-500 font-black not-italic leading-none">XU</span>
                    </div>
                </div>
            </div>
            <button @click="navigateTo('/withdraw', true)" class="w-8 h-8 bg-red-700 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-all active:scale-90 shadow-lg">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </button>
        </div>
     </div>

     <p class="text-slate-500 text-[9px] tracking-[3px] px-3 mb-1.5 opacity-60 italic">TRANG CHÍNH</p>

     <button @click="navigateTo('/')" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-[14px] bg-[#200f0c] border border-red-700/30 text-red-500 text-[13px] font-bold shadow-inner mb-0.5 transition-all">
       <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect></svg>
       Trang Chủ
     </button>

     <button @click="navigateTo('/profile', true)" class="w-full relative flex items-center gap-3 px-4 py-3 rounded-[14px] bg-gradient-to-r from-orange-600/10 to-red-600/5 border border-orange-500/40 hover:bg-orange-500/20 text-orange-400 text-[13px] font-black transition-all group my-2 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
       <div class="absolute -top-2 -right-1 z-20 flex items-center gap-1 bg-gradient-to-r from-orange-600 to-red-600 text-white text-[7px] px-2 py-1 rounded-bl-xl rounded-tr-lg font-black italic animate-bounce">
         SIÊU HOT 🔥
       </div>
       <svg class="w-4 h-4 shrink-0 text-orange-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
       Nhận Quà 300k
     </button>

     <button @click="navigateTo('/profile', true)" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-[14px] hover:bg-[#1a0e0c] text-slate-400 text-[13px] font-bold hover:text-white transition-all">
       <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
       Hồ Sơ Cá Nhân
     </button>

     <button @click="navigateTo('/submit-report', true)" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-[14px] hover:bg-[#1a0e0c] text-slate-400 text-[13px] font-bold hover:text-white transition-all">
       <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="9 15 11 17 15 13"></polyline></svg>
       Gửi Bằng Chứng
     </button>

     <button @click="handleHistoryClick" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-[14px] hover:bg-[#1a0e0c] text-slate-400 text-[13px] font-bold hover:text-white transition-all">
       <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 12 12 17 22 12"></polyline><polyline points="2 17 12 22 22 17"></polyline></svg>
       Lịch Sử Hoạt Động
     </button>

     <button @click="navigateTo('/withdraw', true)" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-[14px] hover:bg-[#1a0e0c] text-slate-400 text-[13px] font-bold hover:text-white transition-all">
       <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
       Rút Tiền
     </button>

     <p class="text-slate-500 text-[9px] tracking-[3px] px-3 mb-1.5 mt-3 border-t border-slate-800/50 pt-3 opacity-70 italic">🎬 CÔNG VIỆC HOT MỖI NGÀY</p>

     <!-- NÚT JOB 1: FOLLOW CGV (HIỂN THỊ CẢ PC LẪN MOBILE) -->
     <button @click="navigateTo('/job/follow-cgv')" class="w-full relative flex items-center justify-between px-3 py-3 rounded-[18px] bg-gradient-to-r from-red-700/25 to-red-600/5 border-2 border-red-600/60 hover:border-red-500 shadow-[0_0_25px_rgba(220,38,38,0.22)] transition-all group mb-2">
       <div class="flex items-center gap-3">
         <div class="w-8 h-8 rounded-xl bg-red-700 flex items-center justify-center shadow-lg group-hover:rotate-12 shrink-0"><span class="text-white font-black text-[13px]">🎬</span></div>
         <div class="text-left"><span class="text-red-400 text-[11px] block leading-none mb-1">Follow Fanpage CGV</span><span class="text-white/40 text-[12px] normal-case font-bold">Thưởng 20k xu</span></div>
       </div>
       <div class="relative flex items-center justify-center px-1.5 py-0.5">
         <div class="absolute inset-0 bg-red-700 blur-[4px] rounded-full animate-pulse"></div>
         <div class="relative z-10 flex items-center gap-0.5 bg-gradient-to-r from-red-700 to-rose-600 border border-red-300/30 px-1 py-0.5 rounded-md">
           <span class="text-[7px] text-white font-black">HOT</span><span class="text-[9px]">🎬</span>
         </div>
       </div>
     </button>

     <!-- NÚT JOB 2: CHECK-IN RẠP (HIỂN THỊ CẢ PC LẪN MOBILE) -->
     <button @click="navigateTo('/job/checkin-cinema')" class="w-full relative flex items-center justify-between px-3 py-3 rounded-[18px] bg-gradient-to-r from-rose-600/25 to-pink-600/5 border-2 border-rose-500/60 hover:border-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.22)] transition-all group mb-4">
       <div class="flex items-center gap-3">
         <div class="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center shadow-lg group-hover:rotate-12 shrink-0"><span class="text-white font-black text-[13px]">📸</span></div>
         <div class="text-left"><span class="text-rose-400 text-[11px] block leading-none mb-1">Check-in Tại Rạp</span><span class="text-white/40 text-[12px] normal-case font-bold">Thưởng 30k xu</span></div>
       </div>
       <div class="relative flex items-center justify-center px-1.5 py-0.5">
         <div class="absolute inset-0 bg-rose-600 blur-[4px] rounded-full animate-pulse"></div>
         <div class="relative z-10 flex items-center gap-0.5 bg-gradient-to-r from-rose-600 to-pink-500 border border-rose-300/30 px-1 py-0.5 rounded-md">
           <span class="text-[7px] text-white font-black">HOT</span><span class="text-[9px]">🎬</span>
         </div>
       </div>
     </button>

     <!-- DANH SÁCH JOB NHỎ Ở DƯỚI (Dùng job.mobile để điều khiển ẩn/hiện) -->
     <div class="space-y-1 border-t border-slate-800/30 pt-3">
       <button v-for="job in [
         { id: 'review-cinema',  name: 'Đánh Giá Rạp Phim',  tag: '⭐', color: 'text-amber-400',  mobile: true,  route: '' },
         { id: 'survey-cinema',  name: 'Khảo Sát Xem Phim',  tag: '📋', color: 'text-violet-400', mobile: true,  route: '/survey-cinema' },
         { id: 'google-map',     name: 'Google Map',           tag: 'MAP', color: 'text-fuchsia-400', mobile: true,  route: '' },
         { id: 'join-zalo',      name: 'Nhóm Zalo',           tag: 'ZALO', color: 'text-red-400',   mobile: false, route: '' },
         { id: 'app-chung-khoan',   name: 'APP Kafi X',   tag: 'CK1', color: 'text-orange-500', mobile: false, route: '' },
         { id: 'app-chung-khoan-2', name: 'APP DNSE',    tag: 'CK2', color: 'text-orange-500', mobile: false, route: '' },
         { id: 'app-chung-khoan-3', name: 'APP KIS',     tag: 'CK3', color: 'text-orange-500', mobile: false, route: '' },
         { id: 'msb-bank',          name: 'APP MSB',     tag: 'MSB', color: 'text-orange-500', mobile: false, route: '' },
         { id: 'vpbank',            name: 'APP VPBank',  tag: 'VPB', color: 'text-orange-500', mobile: false, route: '' },
         { id: 'tpbank',            name: 'APP TPBank',  tag: 'TPB', color: 'text-orange-500', mobile: false, route: '' }
       ]"
               :key="job.id"
               @click="navigateTo(job.route || ('/job/' + job.id))"
               :class="['w-full items-center justify-between px-3 py-2 rounded-[14px] hover:bg-[#1a0e0c] text-slate-400 hover:text-white transition-all group', job.mobile ? 'flex' : 'hidden lg:flex']">
         <div class="flex items-center gap-3">
           <div class="w-7 h-7 rounded-lg bg-[#120b0a] border border-slate-700/50 flex items-center justify-center shadow-md group-hover:scale-110 shrink-0">
              <span :class="['font-black text-[8px]', job.color]">{{ job.tag }}</span>
           </div>
           <span class="text-[11px] font-bold">{{ job.name }}</span>
         </div>
         <div class="flex items-center gap-0.5 bg-gradient-to-r from-red-600 to-orange-500 px-1.5 py-0.5 rounded-md scale-90">
           <span class="text-[7px] text-white font-black">HOT</span><span class="text-[9px]">🔥</span>
         </div>
       </button>
     </div>
   </div>

   <div class="p-4 border-t border-slate-800/50 bg-[#120b0a]/50 shrink-0">
     <div v-if="isLoggedIn">
       <button @click="emit('logout')" class="w-full py-2.5 text-slate-500 hover:text-red-400 text-[10px] font-black tracking-[2px] transition-colors border border-slate-800/50 hover:border-red-500/30 hover:bg-red-500/10 rounded-xl">
         ĐĂNG XUẤT
       </button>
     </div>
     <div v-else class="text-center py-1 text-[9px] text-slate-600 opacity-40 tracking-widest">
       RẠP JOB SYSTEM
     </div>
   </div>
 </aside>
</template>

<style scoped>
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
.normal-case { text-transform: none; }
.animate-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .7; transform: scale(1.05); } }
</style>