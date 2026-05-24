import { createRouter, createWebHashHistory } from 'vue-router' // ĐỔI THÀNH createWebHashHistory

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

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/register', name: 'register', component: RegisterView },
  { path: '/submit-report', name: 'submit-report', component: SubmitReportView },
  { path: '/withdraw', name: 'withdraw', component: WithdrawView },
  { path: '/job/:id', name: 'job-detail', component: JobDetailView },
  { path: '/admin', name: 'admin', component: AdminView },
  { path: '/profile', name: 'profile', component: ProfileView },
  // @ts-ignore
  { path: '/survey-cinema', name: 'survey-cinema', component: () => import('@/views/SurveyView.vue') }
]

const router = createRouter({
  // SỬA TẠI ĐÂY: Dùng Hash History để tránh lỗi 404 trên GitHub Pages khi F5
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

export default router