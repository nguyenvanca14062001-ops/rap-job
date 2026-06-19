import { ref, onUnmounted } from 'vue'
import { db } from '@/firebase'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'

// --- Singleton state (module-level) ---
// Đảm bảo mỗi browser tab chỉ có 1 Firestore listener, dù có nhiều component dùng composable này.
const vipJobs = ref<any[]>([])
const ready = ref(false)
let unsub: (() => void) | null = null
let refCount = 0

function startListener() {
  unsub = onSnapshot(
    query(collection(db, 'vip_jobs'), orderBy('order', 'asc')),
    snap => {
      vipJobs.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      ready.value = true
    },
    () => { ready.value = true }
  )
}

function stopListener() {
  if (unsub) { unsub(); unsub = null }
  vipJobs.value = []
  ready.value = false
}

export function useVipJobs() {
  if (refCount === 0) startListener()
  refCount++

  onUnmounted(() => {
    refCount--
    if (refCount === 0) stopListener()
  })

  return { vipJobs, ready }
}
