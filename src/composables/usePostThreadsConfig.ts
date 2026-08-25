import { ref, onUnmounted } from 'vue'
import { db } from '@/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import {
  POST_THREADS_CONFIG_COLLECTION, POST_THREADS_CONFIG_DOC_ID,
  POST_THREADS_CONFIG_DEFAULT, normalizePostThreadsConfig,
  type PostThreadsJobConfig
} from '@/utils/postThreadsConfig'

// --- Singleton state (module-level), giống pattern useVipJobs.ts ---
// Đảm bảo mỗi browser tab chỉ có 1 Firestore listener, dù có nhiều component dùng composable này.
const config = ref<PostThreadsJobConfig>(POST_THREADS_CONFIG_DEFAULT)
const ready = ref(false)
let unsub: (() => void) | null = null
let refCount = 0

function startListener() {
  unsub = onSnapshot(
    doc(db, POST_THREADS_CONFIG_COLLECTION, POST_THREADS_CONFIG_DOC_ID),
    snap => {
      // Doc chưa tồn tại → dùng default (open/visible) để không làm mất job.
      config.value = snap.exists() ? normalizePostThreadsConfig(snap.data()) : POST_THREADS_CONFIG_DEFAULT
      ready.value = true
    },
    () => { config.value = POST_THREADS_CONFIG_DEFAULT; ready.value = true }
  )
}

function stopListener() {
  if (unsub) { unsub(); unsub = null }
  config.value = POST_THREADS_CONFIG_DEFAULT
  ready.value = false
}

export function usePostThreadsConfig() {
  if (refCount === 0) startListener()
  refCount++

  onUnmounted(() => {
    refCount--
    if (refCount === 0) stopListener()
  })

  return { config, ready }
}
