<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/firebase'
import { signInWithEmailAndPassword, signOut } from "firebase/auth"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"

const router = useRouter()
const loginInput = ref('') 
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

const handleLogin = async () => {
  if (!loginInput.value || !password.value) {
    alert('Vui lòng nhập tài khoản và mật khẩu!')
    return
  }

  loading.value = true
  try {
    // XÓA BỎ LỆNH .toLowerCase() ÉP BUỘC, GIỮ NGUYÊN CHỮ KHÁCH GÕ
    let rawInput = loginInput.value.trim()
    let emailToSignIn = ''

    if (rawInput.includes('@')) {
      emailToSignIn = rawInput.toLowerCase()
    } else {
      // TẦNG 1: Quét chính xác theo trường username (VD: Anhyeuem2001)
      let q = query(collection(db, "users"), where("username", "==", rawInput))
      let querySnapshot = await getDocs(q)
      
      // TẦNG 2: Nếu không thấy, quét bằng chữ thường (Phòng hờ)
      if (querySnapshot.empty) {
        q = query(collection(db, "users"), where("username", "==", rawInput.toLowerCase()))
        querySnapshot = await getDocs(q)
      }

      // TẦNG 3: Vét nốt khách cũ (Kiểm tra xem ID Document có phải là số điện thoại/username không)
      if (querySnapshot.empty) {
        const docRef = doc(db, "users", rawInput)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          emailToSignIn = docSnap.data()?.email
        } else {
          // Thử nốt ID bằng chữ thường cho chắc chắn 100%
          const docRefLower = doc(db, "users", rawInput.toLowerCase())
          const docSnapLower = await getDoc(docRefLower)
          if (docSnapLower.exists()) {
            emailToSignIn = docSnapLower.data()?.email
          } else {
            throw new Error('Tên đăng nhập không tồn tại!')
          }
        }
      } else {
        emailToSignIn = querySnapshot.docs[0]?.data()?.email
      }
    }

    if (!emailToSignIn) {
      throw new Error('Không tìm thấy email liên kết với tài khoản này!')
    }

    // Tiến hành đăng nhập
    const userCredential = await signInWithEmailAndPassword(auth, emailToSignIn, password.value)
    const user = userCredential.user

    const userDoc = await getDoc(doc(db, "users", user.uid))
    
    if (userDoc.exists()) {
      const userData = userDoc.data()
      const isBoss = emailToSignIn === 'nguyenvanca14062001@gmail.com';
      
      if (!isBoss && userData.role !== 'admin' && userData.site && userData.site !== 'rapjob') {
        await signOut(auth)
        localStorage.clear()
        throw new Error('Tài khoản này không thuộc RẠP JOB. Vui lòng đăng nhập đúng trang web!')
      }
    }

    localStorage.clear()
    alert('Đăng nhập thành công! Bắt đầu kiếm tiền thôi nào.')

    setTimeout(() => {
      router.push('/')
    }, 500)

  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      alert('Tài khoản hoặc mật khẩu không chính xác!')
    } else {
      alert(error.message)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-white flex font-sans overflow-y-auto lg:overflow-hidden pb-40 lg:pb-0">
    
    <div class="hidden lg:flex lg:w-1/2 bg-[#f8fafc] flex-col items-center justify-center p-12 relative overflow-hidden">
      <div class="absolute -top-20 -right-20 w-96 h-96 bg-red-100 rounded-full blur-[120px] opacity-60"></div>
      <div class="absolute -bottom-20 -left-20 w-96 h-96 bg-emerald-100 rounded-full blur-[120px] opacity-60"></div>

      <div class="absolute top-12 left-12 flex flex-col items-start text-left">
        <div class="flex items-center gap-2 mb-3">
          <div class="bg-red-700 text-white font-black px-3 py-1 rounded-md italic text-[10px] shadow-lg shadow-red-200 uppercase tracking-widest">HỆ THỐNG KIẾM TIỀN</div>
          <div class="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
        </div>
        <h1 class="text-5xl font-black text-slate-800 tracking-tighter uppercase italic leading-[0.9]">
          KIẾM TIỀN ONLINE <br/>
          <span class="text-red-600 font-black italic">RẠP JOB</span>
        </h1>
        <p class="text-slate-400 font-black text-[10px] tracking-[5px] mt-4 border-l-4 border-red-700 pl-4 uppercase leading-none italic">
          Nền tảng kiếm tiền uy tín số 1 Việt Nam
        </p>
      </div>

      <div class="max-w-md relative z-10 animate-float">
        <img src="https://cdni.iconscout.com/illustration/premium/thumb/business-partnership-illustration-download-in-svg-png-gif-file-formats--meeting-shaking-hands-collaboration-agreement-pack-office-work-illustrations-4712534.png" alt="RẠP JOB Illustration" class="w-full h-auto drop-shadow-[0_35px_35px_rgba(185,28,28,0.12)]">
      </div>

      <div class="absolute bottom-12 left-12 flex items-center gap-6 opacity-40 grayscale">
         <img src="https://upload.wikimedia.org/wikipedia/commons/2/25/Logo_MB_Bank.png" class="h-6">
         <img src="https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png" class="h-6">
      </div>
    </div>

    <div class="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
      <button class="absolute top-6 left-6 lg:hidden z-50 text-2xl text-slate-800">☰</button>

      <div class="w-full max-w-md space-y-10">
        <div class="lg:hidden text-center mb-10">
            <h2 class="text-3xl font-black text-slate-800 italic uppercase tracking-tighter leading-none">RẠP <span class="text-red-600">JOB</span></h2>
            <p class="text-[9px] text-slate-400 font-black tracking-[3px] uppercase mt-1 italic">Hệ thống kiếm tiền Online</p>
        </div>

        <div class="text-left">
          <h2 class="text-4xl font-black text-slate-800 uppercase italic tracking-tight leading-none">ĐĂNG NHẬP</h2>
          <p class="text-slate-400 text-sm mt-4 font-bold italic uppercase tracking-widest opacity-70">Chào mừng bạn trở lại hệ thống.</p>
        </div>

        <div class="space-y-6">
          <div class="space-y-2 text-left">
            <label class="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Email hoặc Tên đăng nhập</label>
            <div class="relative group">
              <span class="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-600 transition-colors text-lg">👤</span>
              <input v-model="loginInput" type="text" placeholder="USERNAME HOẶC EMAIL..." 
                     class="w-full bg-slate-50 border border-slate-100 rounded-[25px] py-6 pl-16 pr-8 text-slate-700 outline-none focus:border-red-600 focus:bg-white transition-all font-black placeholder:text-slate-300 italic text-sm shadow-inner" />
            </div>
          </div>

          <div class="space-y-2 text-left">
            <div class="flex justify-between items-center px-1">
              <label class="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Mật khẩu</label>
            </div>
            <div class="relative group">
              <span class="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-600 transition-colors text-lg">🔒</span>
              <input v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="••••••••" 
                     class="w-full bg-slate-50 border border-slate-100 rounded-[25px] py-6 pl-16 pr-8 text-slate-700 outline-none focus:border-red-600 focus:bg-white transition-all font-black placeholder:text-slate-300 text-sm shadow-inner" />
              <button @click="showPassword = !showPassword" class="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-all">
                {{ showPassword ? '👁️' : '🙈' }}
              </button>
            </div>
          </div>

          <button @click="handleLogin" :disabled="loading" class="w-full bg-red-700 hover:bg-red-800 py-6 rounded-[25px] text-white font-black uppercase italic shadow-[0_20px_40px_rgba(185,28,28,0.3)] transition-all flex items-center justify-center gap-4 group active:scale-95 text-lg disabled:opacity-50">
            {{ loading ? 'ĐANG KIỂM TRA...' : 'VÀO HỆ THỐNG KIẾM TIỀN' }}
            <span v-if="!loading" class="text-2xl group-hover:translate-x-2 transition-transform">➔</span>
          </button>
        </div>

        <div class="pt-10 pb-10 text-center">
          <p class="text-[12px] font-black text-slate-400 uppercase italic tracking-[2px]">
            Chưa có tài khoản? 
            <span @click="router.push('/register')" class="text-red-600 cursor-pointer hover:underline ml-2 text-sm">ĐĂNG KÝ TẠI ĐÂY</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(2deg); }
}
.animate-float {
  animation: float 6s ease-in-out infinite;
}
input::placeholder {
  letter-spacing: 2px;
  font-weight: 900;
}
</style>