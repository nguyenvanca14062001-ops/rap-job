<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isInApp = ref(false)
const currentUrl = ref('')
const isCopied = ref(false)
const linkInputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  const url = new URL(window.location.href)
  url.searchParams.delete('fbclid')
  currentUrl.value = url.toString()
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // NÂNG CẤP LƯỚI LỌC TIA X: Thêm 'Barcelona' (Tên mã của Threads), 'wv', 'WebView', 'FBIOS'
  const rules = [
    'FBAN', 'FBAV', 'FBIOS', // Dòng họ nhà Facebook, Messenger
    'Zalo', // Zalo
    'Instagram', // Instagram
    'Threads', 'Barcelona', // Bắt chết Threads cả tên thật lẫn tên ẩn
    'TikTok', 'trill', 'ByteLocale', // TikTok
    'Messenger', 'Line', 'Viber', // App chat
    'wv', 'WebView' // Tóm gọn mọi loại trình duyệt nhúng trên Android
  ]
  
  // Dùng RegExp quét không phân biệt hoa thường
  const isBadBrowser = rules.some(rule => new RegExp(rule, 'i').test(ua))

  // BẪY PHỤ CHO IPHONE: Nếu xài iOS mà trình duyệt đéo có chữ Safari -> Chắc chắn là Webview ẩn
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua);
  const isIOSWebview = isIOS && !isSafari;

  // Nếu dính lưới Regex HOẶC dính bẫy iOS Webview -> Khóa mõm, bật bảng chặn!
  if (isBadBrowser || isIOSWebview) {
    isInApp.value = true
  }
})

// THUẬT TOÁN COPY TRỰC TIẾP TỪ Ô INPUT (Giữ nguyên cái này của mày vì nó chống mù iOS quá tốt)
const copyLink = () => {
  if (!linkInputRef.value) return;
  
  try {
    // Ép trình duyệt focus và bôi đen toàn bộ chữ trong ô input
    linkInputRef.value.select();
    linkInputRef.value.setSelectionRange(0, 99999); // Dành riêng cho thiết bị Mobile
    
    // Gọi lệnh copy cổ điển (tỷ lệ thành công 99% trên Webview)
    const successful = document.execCommand('copy');
    
    if (successful) {
      isCopied.value = true;
      setTimeout(() => { isCopied.value = false }, 2500);
    } else {
      // Nếu máy nó bảo mật quá chặn luôn thì báo nó tự copy thủ công
      alert('⚠️ Trình duyệt chặn copy tự động! Vui lòng NHẤN GIỮ vào ô link bên dưới và chọn "Sao chép" thủ công nhé.');
    }
  } catch (err) {
    alert('⚠️ Trình duyệt chặn copy tự động! Vui lòng NHẤN GIỮ vào ô link bên dưới và chọn "Sao chép" thủ công nhé.');
  }
}
</script>

<template>
  <div v-if="isInApp" class="fixed inset-0 z-[999999] bg-[#090e17]/95 backdrop-blur-xl flex items-center justify-center p-6 text-center font-black italic uppercase font-sans">
    <div class="bg-[#111726] border border-blue-500/30 w-full max-w-sm rounded-[40px] p-8 shadow-[0_0_50px_rgba(37,99,235,0.15)] relative overflow-hidden">
      
      <!-- Icon mượt mà -->
      <div class="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-inner">
        <span class="text-4xl animate-bounce">✨</span>
      </div>

      <h2 class="text-2xl text-white tracking-tighter mb-4 leading-tight">
        TỐI ƯU <br/> <span class="text-blue-500">TRẢI NGHIỆM</span>
      </h2>

      <!-- Câu chữ đã đổi chuẩn ý mày -->
      <p class="text-slate-300 text-[12px] normal-case font-bold leading-relaxed mb-8 italic">
        Để trải nghiệm trang web mượt mà hơn, bạn nên sao chép link bên dưới và dán vào <span class="text-emerald-400 font-black">Chrome</span> hoặc <span class="text-blue-400 font-black">Safari</span> để hệ thống hoạt động tốt nhất nhé!
      </p>

      <!-- Ô CHỨA LINK - KHÁCH CÓ THỂ NHẤN GIỮ ĐỂ TỰ COPY -->
      <div class="mb-4 relative group">
         <p class="text-[9px] text-slate-500 tracking-[2px] mb-2 text-left ml-2">LIÊN KẾT TRANG WEB:</p>
         <input 
           ref="linkInputRef"
           type="text" 
           readonly 
           :value="currentUrl" 
           class="w-full bg-[#0d121f] text-white text-[12px] normal-case py-4 px-4 rounded-xl border border-slate-700 outline-none text-left font-sans font-bold shadow-inner focus:border-blue-500 transition-colors cursor-text" 
         />
      </div>

      <!-- NÚT COPY -->
      <button 
        @click="copyLink" 
        :class="isCopied ? 'bg-emerald-500 shadow-emerald-500/40 text-[#090e17]' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40 text-white'" 
        class="w-full py-4 mt-2 rounded-2xl text-sm font-black tracking-[2px] transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2"
      >
        <span v-if="!isCopied">📋 SAO CHÉP LIÊN KẾT</span>
        <span v-else>✅ ĐÃ SAO CHÉP THÀNH CÔNG</span>
      </button>

      <p class="text-slate-500 text-[9px] normal-case font-bold mt-5 italic">
        *Mẹo: Nếu nút không hoạt động, hãy nhấn giữ vào đường link phía trên để tự sao chép.
      </p>

    </div>
  </div>
</template>