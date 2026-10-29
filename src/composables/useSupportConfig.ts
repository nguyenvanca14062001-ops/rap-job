import { ref } from 'vue'
import { db } from '@/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

// Bảng Hỗ trợ (SupportPanel) chỉ mở khi người dùng tự bấm nút ở desktop. Web KHÔNG còn tự bật bảng này khi vào trang
// (Admin vẫn còn công tắc autoPopupEnabled nhưng không còn tác dụng) — người mới thay bằng popup Khám phá công việc
// (utils/jobIntro.ts), nút HỖ TRỢ trên mobile mở thẳng Messenger Fanpage (utils/fanpage.ts).
const DEFAULT_CONFIG = {
  enabled: true,
  announcementVersion: 1,
  title: 'Hỗ trợ',
  message: 'Cần hỗ trợ? Vui lòng nhắn tin Fanpage để được xử lý.',
}

export const supportConfig = ref({ ...DEFAULT_CONFIG })
export const supportBadge = ref(false)

let _started = false
const currentUserKey = ref<string | null>(null)

function evaluateBadge() {
  if (!currentUserKey.value) {
    supportBadge.value = false
    return
  }
  if (window.location.hash.includes('/admin')) return
  const key = `seenSupportAnnouncementVersion_${currentUserKey.value}`
  const seen = Number(localStorage.getItem(key) || '0')
  supportBadge.value = supportConfig.value.enabled && supportConfig.value.announcementVersion > seen
}

export function setUserContext(uid: string | null) {
  currentUserKey.value = uid
  evaluateBadge()
}

export function markSupportSeen() {
  if (!currentUserKey.value) return
  const key = `seenSupportAnnouncementVersion_${currentUserKey.value}`
  localStorage.setItem(key, String(supportConfig.value.announcementVersion))
  supportBadge.value = false
}

export function startSupportListener() {
  if (_started) return
  _started = true

  onSnapshot(
    doc(db, 'support_config', 'overall'),
    (snap) => {
      try {
        const data = snap.exists() ? snap.data() : DEFAULT_CONFIG
        supportConfig.value = {
          enabled: data.enabled ?? DEFAULT_CONFIG.enabled,
          announcementVersion: Number(data.announcementVersion ?? DEFAULT_CONFIG.announcementVersion),
          title: (data.title as string) ?? DEFAULT_CONFIG.title,
          message: (data.message as string) ?? DEFAULT_CONFIG.message,
        }
        evaluateBadge()
      } catch (e) {
        console.error('[SupportConfig] Error in snapshot handler:', e)
      }
    },
    (error) => {
      console.warn('[SupportConfig] Firestore listener error (ignored):', error.code)
    }
  )
}
