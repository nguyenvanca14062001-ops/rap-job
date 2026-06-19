import Swal from 'sweetalert2'
import { db } from '@/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

let _started = false

export function startAppConfigListener() {
  if (_started) return
  _started = true

  onSnapshot(
    doc(db, 'app_config', 'overall'),
    (snap) => {
      try {
        const newVersion = snap.exists() ? ((snap.data().appVersion as number) || 0) : 0
        const handledVersion = Number(sessionStorage.getItem('handledAppVersion') || '0')

        if (window.location.hash.includes('/admin')) return

        if (handledVersion === 0) {
          sessionStorage.setItem('handledAppVersion', String(newVersion))
          return
        }

        if (newVersion <= handledVersion) return

        sessionStorage.setItem('handledAppVersion', String(newVersion))

        if (!snap.exists()) return

        const data = snap.data()
        const msg = (data.refreshMessage as string) || 'Hệ thống vừa cập nhật phiên bản mới.'

        if (data.forceRefreshEnabled) {
          Swal.fire({
            title: '🔄 Cập Nhật Hệ Thống',
            text: msg + '\nTrang sẽ tự tải lại sau 3 giây...',
            icon: 'info',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            allowOutsideClick: false,
          }).then(() => window.location.reload())
        } else {
          Swal.fire({
            title: '🔄 Cập Nhật Hệ Thống',
            text: msg,
            icon: 'info',
            confirmButtonText: 'Tải lại ngay',
            allowOutsideClick: false,
          }).then(() => window.location.reload())
        }
      } catch (e) {
        console.error('[AppConfig] Error in snapshot handler:', e)
      }
    },
    (error) => {
      console.warn('[AppConfig] Firestore listener error (ignored):', error.code)
    }
  )
}
