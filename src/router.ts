import { createRouter, createWebHashHistory } from 'vue-router'
// @ts-ignore
import { auth } from '@/firebase'

// Sử dụng @ để trỏ trực tiếp từ thư mục src/
// @ts-ignore
import HomeView from '@/views/HomeView.vue'
// @ts-ignore
import LoginView from '@/views/LoginView.vue'
// @ts-ignore
import RegisterView from '@/views/RegisterView.vue'
// @ts-ignore
import SubmitReportView from '@/views/SubmitReportView.vue'
// @ts-ignore
import WithdrawView from '@/views/WithdrawView.vue'
// @ts-ignore
import JobDetailView from '@/views/JobDetailView.vue'
// @ts-ignore
import AdminView from '@/views/AdminView.vue'
// @ts-ignore
import ProfileView from '@/views/Profile.vue'
// @ts-ignore
import ReferralLpbankView from '@/views/ReferralLpbankView.vue'
// @ts-ignore
import DailyThreadsView from '@/views/DailyThreadsView.vue'
// @ts-ignore
import ZaloKokomiView from '@/views/ZaloKokomiView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/register', name: 'register', component: RegisterView },
  { path: '/submit-report', name: 'submit-report', component: SubmitReportView },
  { path: '/withdraw', name: 'withdraw', component: WithdrawView },
  { path: '/job/:id', name: 'job-detail', component: JobDetailView },
  { path: '/admin', name: 'admin', component: AdminView },
  { path: '/profile', name: 'profile', component: ProfileView },
  { path: '/jobs/referral-lpbank', name: 'referral-lpbank', component: ReferralLpbankView },
  { path: '/jobs/daily-threads', name: 'daily-threads', component: DailyThreadsView },
  { path: '/jobs/zalo-kokomi', name: 'zalo-kokomi', component: ZaloKokomiView },
  // @ts-ignore
  { path: '/survey-cinema', name: 'survey-cinema', component: () => import('@/views/SurveyView.vue') }
]

const router = createRouter({
  // SỬA TẠI ĐÂY: Dùng Hash History để tránh lỗi 404 trên GitHub Pages khi F5
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

const requiresAuth = ['/profile', '/withdraw', '/submit-report', '/history', '/jobs/referral-lpbank', '/jobs/daily-threads', '/jobs/zalo-kokomi']

router.beforeEach(async (to, from, next) => {
  await auth.authStateReady()
  const user = auth.currentUser
  if (requiresAuth.includes(to.path) && !user) {
    next('/login')
  } else {
    next()
  }
})

export default router