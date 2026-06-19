import { ref } from 'vue'
import { db } from '@/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

const DEFAULT_CONFIG = {
  enabled: true,
  autoPopupEnabled: false,
  announcementVersion: 1,
  title: 'Hỗ trợ',
  message: 'Cần hỗ trợ? Vui lòng nhắn tin Fanpage để được xử lý.',
}

export const supportConfig = ref({ ...DEFAULT_CONFIG })
export const supportBadge = ref(false)
export const shouldAutoPopup = ref(false)

let _started = false
const currentUserKey = ref<string | null>(null)

function evaluateBadgeAndPopup() {
  if (!currentUserKey.value) {
    supportBadge.value = false
    shouldAutoPopup.value = false
    return
  }
  if (window.location.hash.includes('/admin')) return
  const key = `seenSupportAnnouncementVersion_${currentUserKey.value}`
  const seen = Number(localStorage.getItem(key) || '0')
  const hasNew = supportConfig.value.enabled && supportConfig.value.announcementVersion > seen
  supportBadge.value = hasNew
  if (hasNew && supportConfig.value.autoPopupEnabled) shouldAutoPopup.value = true
}

export function setUserContext(uid: string | null) {
  currentUserKey.value = uid
  shouldAutoPopup.value = false
  evaluateBadgeAndPopup()
}

export function markSupportSeen() {
  if (!currentUserKey.value) return
  const key = `seenSupportAnnouncementVersion_${currentUserKey.value}`
  localStorage.setItem(key, String(supportConfig.value.announcementVersion))
  supportBadge.value = false
  shouldAutoPopup.value = false
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
          autoPopupEnabled: data.autoPopupEnabled ?? DEFAULT_CONFIG.autoPopupEnabled,
          announcementVersion: Number(data.announcementVersion ?? DEFAULT_CONFIG.announcementVersion),
          title: (data.title as string) ?? DEFAULT_CONFIG.title,
          message: (data.message as string) ?? DEFAULT_CONFIG.message,
        }
        evaluateBadgeAndPopup()
      } catch (e) {
        console.error('[SupportConfig] Error in snapshot handler:', e)
      }
    },
    (error) => {
      console.warn('[SupportConfig] Firestore listener error (ignored):', error.code)
    }
  )
}
