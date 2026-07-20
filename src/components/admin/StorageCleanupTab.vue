<script setup lang="ts">
import { ref, watch } from 'vue'
import { db, storage } from '@/firebase'
import { collection, query, where, orderBy, limit, startAfter, documentId, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, deleteObject } from 'firebase/storage'
import Swal from 'sweetalert2'

// Job VIP/ngân hàng/chứng khoán — dùng chung tiêu chí với AdminView (isAppJob)
const isAppJob = (jobName: string) => {
  if (!jobName) return false
  const n = jobName.toLowerCase()
  return ['app', 'ngân hàng', 'chứng khoán', 'vpbank', 'tpbank', 'mbbank', 'msb', 'cake', 'tnex', 'kafi', 'dnse', 'kis'].some(kw => n.includes(kw))
}

// ============================================================================
// STORAGE CLEANUP — quét theo lô nhỏ (30 đơn/lô), có chế độ tự động, pause/resume
// ============================================================================
const STORAGE_SCAN_BATCH_SIZE = 30
const STORAGE_SCAN_TIMEOUT_MS = 15000
const NORMALIZE_BATCH_SIZE = 30
const STORAGE_CLEANUP_PROGRESS_KEY = 'storage_cleanup_progress'

interface StorageCandidate {
  reportId: string
  type: 'basic' | 'vip'
  imagePaths: string[]
  report: any
}

interface StorageCleanupProgress {
  mode: 'normalize' | 'clean'
  scanned: number
  normalized: number
  cleanedReports: number
  deletedFiles: number
  skippedNoImages: number
  skippedAlreadyNormalized: number
  skippedPending: number
  skippedVipNotOldEnough: number
  errors: number
  batchNumber: number
  lastDocId: string | null
  isPaused: boolean
  isDone: boolean
  updatedAt: number
}

interface StorageCleanResult {
  checkedReports: number
  pendingSkipped: number
  basicReportCount: number
  vipReportCount: number
  vipTooNewSkipped: number
  totalImageCount: number
  hasMore: boolean
}

type CleanVerdict =
  | { eligible: false; reason: 'already-cleaned' | 'no-images' | 'pending' | 'unprocessed' | 'vip-too-new' }
  | { eligible: true; type: 'basic' | 'vip'; imagePaths: string[] }

const storageCleanupCandidates = ref<StorageCandidate[]>([])
const storageCleanupResult = ref<StorageCleanResult | null>(null)
const lastCleanupDocId = ref<string | null>(null)
const isCheckingStorageCleanup = ref(false)
const isDeletingStorage = ref(false)
const storageCleanupError = ref('')
const storageCleanupProgress = ref('')

// Mặc định BẬT chạy thử để tránh xoá nhầm — admin phải chủ động tắt + xác nhận mới xoá thật.
const isDryRun = ref(true)
const isAutoRunning = ref(false)
const isAutoPaused = ref(false)
const autoStopRequested = ref(false)
const autoRoundCount = ref(0)
const autoStats = ref({ checked: 0, deletedImages: 0, cleanedReports: 0, pendingSkipped: 0, vipNotOldEnough: 0, errors: 0 })
const autoLogs = ref<string[]>([])
const AUTO_LOG_LIMIT = 100

const normalizeLastDocId = ref<string | null>(null)
const isNormalizing = ref(false)
const isNormalizePaused = ref(false)
const normalizeStopRequested = ref(false)
const normalizeBatchCount = ref(0)
const normalizeProgress = ref('')
const normalizeStats = ref({ scanned: 0, normalized: 0, skippedNoImages: 0, skippedAlreadyNormalized: 0, errors: 0 })

// ---- localStorage progress (chống mất tiến trình khi tab crash/reload) ----
const saveCleanupProgress = (progress: StorageCleanupProgress) => {
  try { localStorage.setItem(STORAGE_CLEANUP_PROGRESS_KEY, JSON.stringify(progress)) } catch (e) { console.warn('Save cleanup progress failed:', e) }
}
const loadCleanupProgress = (): StorageCleanupProgress | null => {
  try { const raw = localStorage.getItem(STORAGE_CLEANUP_PROGRESS_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
const clearCleanupProgress = () => { try { localStorage.removeItem(STORAGE_CLEANUP_PROGRESS_KEY) } catch {} }

const persistCleanProgress = (isDone: boolean) => {
  saveCleanupProgress({
    mode: 'clean',
    scanned: autoStats.value.checked,
    normalized: 0,
    cleanedReports: autoStats.value.cleanedReports,
    deletedFiles: autoStats.value.deletedImages,
    skippedNoImages: 0,
    skippedAlreadyNormalized: 0,
    skippedPending: autoStats.value.pendingSkipped,
    skippedVipNotOldEnough: autoStats.value.vipNotOldEnough,
    errors: autoStats.value.errors,
    batchNumber: autoRoundCount.value,
    lastDocId: lastCleanupDocId.value,
    isPaused: isAutoPaused.value,
    isDone,
    updatedAt: Date.now(),
  })
}

const persistNormalizeProgress = (isDone: boolean) => {
  saveCleanupProgress({
    mode: 'normalize',
    scanned: normalizeStats.value.scanned,
    normalized: normalizeStats.value.normalized,
    cleanedReports: 0,
    deletedFiles: 0,
    skippedNoImages: normalizeStats.value.skippedNoImages,
    skippedAlreadyNormalized: normalizeStats.value.skippedAlreadyNormalized,
    skippedPending: 0,
    skippedVipNotOldEnough: 0,
    errors: normalizeStats.value.errors,
    batchNumber: normalizeBatchCount.value,
    lastDocId: normalizeLastDocId.value,
    isPaused: isNormalizePaused.value,
    isDone,
    updatedAt: Date.now(),
  })
}

const initialSavedCleanupProgress = loadCleanupProgress()
const resumeBanner = ref<StorageCleanupProgress | null>(
  initialSavedCleanupProgress && !initialSavedCleanupProgress.isDone ? initialSavedCleanupProgress : null
)

const resumeCleanupFromSaved = () => {
  const p = resumeBanner.value
  if (!p) return
  if (p.mode === 'clean') {
    lastCleanupDocId.value = p.lastDocId
    autoRoundCount.value = p.batchNumber
    autoStats.value = {
      checked: p.scanned, deletedImages: p.deletedFiles, cleanedReports: p.cleanedReports,
      pendingSkipped: p.skippedPending, vipNotOldEnough: p.skippedVipNotOldEnough, errors: p.errors,
    }
    resumeBanner.value = null
    startAutoCleanup()
  } else {
    normalizeLastDocId.value = p.lastDocId
    normalizeBatchCount.value = p.batchNumber
    normalizeStats.value = {
      scanned: p.scanned, normalized: p.normalized, skippedNoImages: p.skippedNoImages,
      skippedAlreadyNormalized: p.skippedAlreadyNormalized, errors: p.errors,
    }
    resumeBanner.value = null
    startNormalizeAuto()
  }
}

const restartCleanupFromScratch = () => {
  const mode = resumeBanner.value?.mode
  if (mode === 'clean') {
    lastCleanupDocId.value = null
    autoRoundCount.value = 0
    autoStats.value = { checked: 0, deletedImages: 0, cleanedReports: 0, pendingSkipped: 0, vipNotOldEnough: 0, errors: 0 }
  } else if (mode === 'normalize') {
    normalizeLastDocId.value = null
    normalizeBatchCount.value = 0
    normalizeStats.value = { scanned: 0, normalized: 0, skippedNoImages: 0, skippedAlreadyNormalized: 0, errors: 0 }
    normalizeProgress.value = ''
  }
  clearCleanupProgress()
  resumeBanner.value = null
}

const discardSavedCleanupProgress = () => { clearCleanupProgress(); resumeBanner.value = null }

const isOlderThan7Days = (createdAt: any): boolean => {
  const createdMs: number = createdAt?.toMillis?.() ?? 0
  return Date.now() - createdMs > 7 * 24 * 60 * 60 * 1000
}
const getAgeDays = (createdAt: any): number | null => {
  const createdMs: number = createdAt?.toMillis?.() ?? 0
  if (!createdMs) return null
  return Math.floor((Date.now() - createdMs) / (24 * 60 * 60 * 1000))
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const randomDelay = () => 500 + Math.random() * 500

const appendAutoLog = (msg: string) => {
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  autoLogs.value.unshift(`[${time}] ${msg}`)
  if (autoLogs.value.length > AUTO_LOG_LIMIT) autoLogs.value.length = AUTO_LOG_LIMIT
}
const clearAutoLogs = () => { autoLogs.value = [] }

const resetStorageCleanup = () => {
  lastCleanupDocId.value = null
  storageCleanupCandidates.value = []
  storageCleanupResult.value = null
  storageCleanupError.value = ''
  storageCleanupProgress.value = ''
  autoRoundCount.value = 0
  autoStats.value = { checked: 0, deletedImages: 0, cleanedReports: 0, pendingSkipped: 0, vipNotOldEnough: 0, errors: 0 }
  if (loadCleanupProgress()?.mode === 'clean') clearCleanupProgress()
}

// Quyết định 1 report có được dọn ảnh hay không, và thuộc loại nào.
// pending => không xoá; job cơ bản đã xử lý => xoá được; VIP đã xử lý & > 7 ngày => xoá được.
const canCleanReport = (report: any): CleanVerdict => {
  if (report.imagesDeleted === true || report.storageCleaned === true) return { eligible: false, reason: 'already-cleaned' }

  const proofImages = Array.isArray(report.proofImages) ? report.proofImages.filter((img: any) => img && img.path) : []
  if (!proofImages.length) return { eligible: false, reason: 'no-images' }

  const status = String(report.status || '').toLowerCase()
  const isPending = status === 'pending' || status === 'waiting' || status === 'submitted' || status.includes('chờ')
  if (isPending) return { eligible: false, reason: 'pending' }

  const isProcessed = status === 'approved' || status === 'rejected' || status === 'collected' || status === 'paid'
  if (!isProcessed) return { eligible: false, reason: 'unprocessed' }

  const imagePaths = proofImages.map((img: any) => img.path)
  if (isAppJob(report.jobName)) {
    if (!isOlderThan7Days(report.createdAt)) return { eligible: false, reason: 'vip-too-new' }
    return { eligible: true, type: 'vip', imagePaths }
  }
  return { eligible: true, type: 'basic', imagePaths }
}

// Quét 1 lô (tối đa STORAGE_SCAN_BATCH_SIZE đơn) bắt đầu từ lastCleanupDocId, có timeout riêng.
const scanNextBatch = async (): Promise<StorageCleanResult & { candidates: StorageCandidate[] }> => {
  const q = lastCleanupDocId.value
    ? query(collection(db, 'reports'), where('storageCleaned', '==', false), orderBy(documentId()), startAfter(lastCleanupDocId.value), limit(STORAGE_SCAN_BATCH_SIZE))
    : query(collection(db, 'reports'), where('storageCleaned', '==', false), orderBy(documentId()), limit(STORAGE_SCAN_BATCH_SIZE))

  let snap
  try {
    snap = await Promise.race([
      getDocs(q),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Firestore query quá ${STORAGE_SCAN_TIMEOUT_MS / 1000} giây, vui lòng thử lại.`)), STORAGE_SCAN_TIMEOUT_MS)
      )
    ])
  } catch (e: any) {
    if (e?.code === 'failed-precondition' || /requires an index/i.test(e?.message || '')) {
      throw new Error('Firestore cần tạo composite index cho truy vấn này. Mở Console (F12) để lấy link tạo index tự động, hoặc bấm "Chuẩn hoá tự động" trước nếu chưa chạy.')
    }
    throw e
  }

  const candidates: StorageCandidate[] = []
  let checkedReports = 0, pendingSkipped = 0, basicReportCount = 0, vipReportCount = 0, vipTooNewSkipped = 0, totalImageCount = 0

  for (const docSnap of snap.docs) {
    checkedReports++
    const report: any = { id: docSnap.id, ...docSnap.data() }
    const verdict = canCleanReport(report)

    if (!verdict.eligible) {
      if (verdict.reason === 'pending') pendingSkipped++
      if (verdict.reason === 'vip-too-new') vipTooNewSkipped++
      continue
    }

    candidates.push({ reportId: report.id, type: verdict.type, imagePaths: verdict.imagePaths, report })
    if (verdict.type === 'vip') vipReportCount++
    else basicReportCount++
    totalImageCount += verdict.imagePaths.length
  }

  const lastDocSnap = snap.docs[snap.docs.length - 1]
  if (lastDocSnap) lastCleanupDocId.value = lastDocSnap.id

  return { candidates, checkedReports, pendingSkipped, basicReportCount, vipReportCount, vipTooNewSkipped, totalImageCount, hasMore: snap.size === STORAGE_SCAN_BATCH_SIZE }
}

// Xoá ảnh Storage cho danh sách candidates rồi đánh dấu report đã dọn.
// Lỗi từng file không làm dừng cả batch; object-not-found coi như đã xoá.
// An toàn: kiểm tra lại canCleanReport(report) ngay trước khi xoá.
const deleteCandidatesBatch = async (candidates: StorageCandidate[], dryRun: boolean) => {
  let deletedImages = 0, cleanedReports = 0, errors = 0

  for (const candidate of candidates) {
    const report = candidate.report
    const verdict = canCleanReport(report)
    const canClean = verdict.eligible

    const status = String(report.status || '').toLowerCase()
    const isPendingStatus = status === 'pending' || status === 'waiting' || status === 'submitted' || status.includes('chờ')
    if (isPendingStatus && canClean) {
      throw new Error(`AN TOÀN: report ${report.id} đang ở status pending nhưng canCleanReport() báo có thể xoá — dừng dọn ngay lập tức để kiểm tra lại logic, không xoá bất kỳ ảnh nào thêm.`)
    }

    if (!canClean) {
      console.warn('Skip cleaning (canCleanReport=false):', report.id, verdict.reason)
      continue
    }

    if (dryRun) {
      deletedImages += candidate.imagePaths.length
      cleanedReports++
      continue
    }

    let deletedCount = 0
    for (const path of candidate.imagePaths) {
      try {
        await deleteObject(storageRef(storage, path))
        deletedCount++
      } catch (e: any) {
        if (e?.code === 'storage/object-not-found') deletedCount++
        else { errors++; console.warn('Storage delete warn:', candidate.reportId, path, e) }
      }
    }
    deletedImages += deletedCount

    try {
      await updateDoc(doc(db, 'reports', candidate.reportId), {
        imagesDeleted: true,
        imagesDeletedAt: serverTimestamp(),
        storageCleaned: true,
        proofImagesCleaned: true,
        proofImagesDeletedCount: deletedCount,
        proofImageCountBeforeClean: candidate.imagePaths.length,
      })
      cleanedReports++
    } catch (e) {
      errors++
      console.warn('Update report failed:', candidate.reportId, e)
    }
  }

  return { deletedImages, cleanedReports, errors }
}

const scanStorageImages = async () => {
  isCheckingStorageCleanup.value = true
  storageCleanupCandidates.value = []
  storageCleanupResult.value = null
  storageCleanupError.value = ''
  storageCleanupProgress.value = 'Đang kiểm tra...'

  try {
    const batch = await scanNextBatch()
    autoRoundCount.value++
    autoStats.value.checked += batch.checkedReports
    autoStats.value.pendingSkipped += batch.pendingSkipped
    autoStats.value.vipNotOldEnough += batch.vipTooNewSkipped
    storageCleanupCandidates.value = batch.candidates
    storageCleanupResult.value = {
      checkedReports: batch.checkedReports, pendingSkipped: batch.pendingSkipped,
      basicReportCount: batch.basicReportCount, vipReportCount: batch.vipReportCount,
      vipTooNewSkipped: batch.vipTooNewSkipped, totalImageCount: batch.totalImageCount, hasMore: batch.hasMore,
    }
    storageCleanupProgress.value = `Đã kiểm tra ${batch.checkedReports} đơn trong lô này.`
    persistCleanProgress(!batch.hasMore)
  } catch (e: any) {
    console.error('Scan storage images failed:', e)
    storageCleanupError.value = e?.message || 'Kiểm tra thất bại.'
    storageCleanupProgress.value = ''
  } finally {
    isCheckingStorageCleanup.value = false
  }
}

const confirmDeleteImages = async () => {
  if (!storageCleanupResult.value || storageCleanupCandidates.value.length === 0) return
  const { isConfirmed } = await Swal.fire({
    title: isDryRun.value ? 'Chạy thử xoá ảnh lô này?' : 'Xác nhận XOÁ THẬT ảnh?',
    text: isDryRun.value
      ? `Chế độ chạy thử — sẽ không xoá ảnh thật, chỉ thống kê ${storageCleanupResult.value.totalImageCount} ảnh.`
      : `Bạn đang chuẩn bị XOÁ THẬT ${storageCleanupResult.value.totalImageCount} ảnh trong Firebase Storage. Ảnh đã xoá sẽ không khôi phục được. Tiếp tục?`,
    icon: 'warning', showCancelButton: true,
    confirmButtonText: isDryRun.value ? 'Chạy thử' : 'Xoá ảnh', cancelButtonText: 'Huỷ', confirmButtonColor: '#dc2626',
  })
  if (!isConfirmed) return

  const wasLastBatch = !storageCleanupResult.value.hasMore
  isDeletingStorage.value = true
  try {
    const result = await deleteCandidatesBatch(storageCleanupCandidates.value, isDryRun.value)
    autoStats.value.deletedImages += result.deletedImages
    autoStats.value.cleanedReports += result.cleanedReports
    autoStats.value.errors += result.errors
    persistCleanProgress(wasLastBatch)
    await Swal.fire('Xong!', `${isDryRun.value ? 'Chạy thử: sẽ xoá' : 'Đã xoá'} ${result.deletedImages} ảnh khỏi Storage.`, 'success')
    storageCleanupCandidates.value = []
    storageCleanupResult.value = null
    storageCleanupProgress.value = ''
  } catch (e) {
    Swal.fire('Lỗi khi xoá', String(e), 'error')
  } finally {
    isDeletingStorage.value = false
  }
}

// ============================================================================
// CHUẨN HOÁ DỮ LIỆU CŨ — set storageCleaned=false cho đơn có ảnh nhưng chưa có field
// ============================================================================
const normalizeNextBatch = async () => {
  normalizeBatchCount.value++

  const q = normalizeLastDocId.value
    ? query(collection(db, 'reports'), orderBy(documentId()), startAfter(normalizeLastDocId.value), limit(NORMALIZE_BATCH_SIZE))
    : query(collection(db, 'reports'), orderBy(documentId()), limit(NORMALIZE_BATCH_SIZE))

  const snap = await Promise.race([
    getDocs(q),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore query quá ${STORAGE_SCAN_TIMEOUT_MS / 1000} giây, vui lòng thử lại.`)), STORAGE_SCAN_TIMEOUT_MS)
    )
  ])

  let scanned = 0, normalized = 0, skippedNoImages = 0, skippedAlreadyNormalized = 0, errors = 0
  const updates: Promise<void>[] = []

  for (const docSnap of snap.docs) {
    scanned++
    const data: any = docSnap.data()
    const proofImages = Array.isArray(data.proofImages) ? data.proofImages : []

    if (!proofImages.length) { skippedNoImages++; continue }
    if (typeof data.storageCleaned !== 'undefined') { skippedAlreadyNormalized++; continue }

    const fields = data.imagesDeleted === true
      ? { storageCleaned: true, proofImagesCleaned: true }
      : { storageCleaned: false, proofImagesCleaned: false, proofImageCountBeforeClean: proofImages.length, normalizedForStorageCleanAt: serverTimestamp() }

    updates.push(
      updateDoc(docSnap.ref, fields)
        .then(() => { normalized++ })
        .catch((e) => { errors++; console.warn('Normalize document failed:', docSnap.id, e) })
    )
  }

  await Promise.allSettled(updates)

  const lastNormalizeDocSnap = snap.docs[snap.docs.length - 1]
  if (lastNormalizeDocSnap) normalizeLastDocId.value = lastNormalizeDocSnap.id

  return { scanned, normalized, skippedNoImages, skippedAlreadyNormalized, errors, hasMore: snap.size === NORMALIZE_BATCH_SIZE }
}

const startNormalizeAuto = async () => {
  if (isNormalizing.value) return

  const { isConfirmed } = await Swal.fire({
    title: 'Chuẩn hoá dữ liệu cũ?',
    text: 'Sẽ tự động quét toàn bộ đơn theo từng lô nhỏ và thêm field storageCleaned cho đơn có ảnh nhưng chưa có field này. Không xoá gì cả — an toàn chạy lại nhiều lần.',
    icon: 'info', showCancelButton: true, confirmButtonText: 'Bắt đầu', cancelButtonText: 'Huỷ',
  })
  if (!isConfirmed) return

  isNormalizing.value = true
  isNormalizePaused.value = false
  normalizeStopRequested.value = false
  storageCleanupError.value = ''
  appendAutoLog('[Chuẩn hoá] Bắt đầu chuẩn hoá dữ liệu cũ')

  while (!normalizeStopRequested.value) {
    if (isNormalizePaused.value) { await sleep(400); continue }

    try {
      const batch = await normalizeNextBatch()
      normalizeStats.value.scanned += batch.scanned
      normalizeStats.value.normalized += batch.normalized
      normalizeStats.value.skippedNoImages += batch.skippedNoImages
      normalizeStats.value.skippedAlreadyNormalized += batch.skippedAlreadyNormalized
      normalizeStats.value.errors += batch.errors
      normalizeProgress.value = `Đã quét ${normalizeStats.value.scanned} đơn, chuẩn hoá ${normalizeStats.value.normalized} đơn...`
      appendAutoLog(`[Chuẩn hoá] Batch ${normalizeBatchCount.value}: quét ${batch.scanned}, chuẩn hoá ${batch.normalized}, bỏ qua ${batch.skippedNoImages + batch.skippedAlreadyNormalized}${batch.errors ? `, lỗi ${batch.errors}` : ''}`)

      if (!batch.hasMore) {
        normalizeProgress.value = `Hoàn tất: quét ${normalizeStats.value.scanned} đơn, chuẩn hoá ${normalizeStats.value.normalized} đơn.`
        appendAutoLog('[Chuẩn hoá] Đã quét hết collection.')
        persistNormalizeProgress(true)
        break
      }
      persistNormalizeProgress(false)
    } catch (e: any) {
      console.error('Normalize batch failed:', e)
      storageCleanupError.value = e?.message || 'Chuẩn hoá thất bại.'
      appendAutoLog(`[Chuẩn hoá] Lỗi batch ${normalizeBatchCount.value}: ${storageCleanupError.value}`)
      persistNormalizeProgress(false)
      break
    }

    await sleep(randomDelay())
  }

  isNormalizing.value = false
}

const pauseNormalizeAuto = () => { isNormalizePaused.value = true; appendAutoLog('[Chuẩn hoá] Tạm dừng'); persistNormalizeProgress(false) }
const resumeNormalizeAuto = () => { isNormalizePaused.value = false; appendAutoLog('[Chuẩn hoá] Tiếp tục') }

// ============================================================================
// DỌN TỰ ĐỘNG — lặp nhiều vòng, mỗi vòng quét 30 đơn rồi xoá ngay, có pause/resume
// ============================================================================
const startAutoCleanup = async () => {
  if (isAutoRunning.value) return

  const { isConfirmed } = await Swal.fire({
    title: isDryRun.value ? 'Chạy thử Dọn tự động?' : 'Xác nhận XOÁ THẬT?',
    text: isDryRun.value
      ? 'Chế độ chạy thử — sẽ không xoá ảnh thật, chỉ thống kê.'
      : 'Bạn đang chuẩn bị XOÁ THẬT ảnh trong Firebase Storage. Ảnh đã xoá sẽ không khôi phục được. Hệ thống KHÔNG xoá document Firestore, chỉ xoá file ảnh Storage. Tiếp tục?',
    icon: 'warning', showCancelButton: true, confirmButtonText: 'Bắt đầu', cancelButtonText: 'Huỷ', confirmButtonColor: '#dc2626',
  })
  if (!isConfirmed) return

  isAutoRunning.value = true
  isAutoPaused.value = false
  autoStopRequested.value = false
  storageCleanupError.value = ''
  appendAutoLog(isDryRun.value ? 'Bắt đầu chạy thử (không xoá thật)' : 'Bắt đầu dọn tự động')

  while (!autoStopRequested.value) {
    if (isAutoPaused.value) { await sleep(400); continue }

    autoRoundCount.value++
    try {
      const batch = await scanNextBatch()
      autoStats.value.checked += batch.checkedReports
      autoStats.value.pendingSkipped += batch.pendingSkipped
      autoStats.value.vipNotOldEnough += batch.vipTooNewSkipped
      appendAutoLog(`Vòng ${autoRoundCount.value}: kiểm tra ${batch.checkedReports} đơn, bỏ qua ${batch.pendingSkipped} pending`)

      if (batch.candidates.length) {
        const result = await deleteCandidatesBatch(batch.candidates, isDryRun.value)
        autoStats.value.deletedImages += result.deletedImages
        autoStats.value.cleanedReports += result.cleanedReports
        autoStats.value.errors += result.errors
        appendAutoLog(`Vòng ${autoRoundCount.value}: ${isDryRun.value ? 'sẽ xoá' : 'đã xoá'} ${result.deletedImages} ảnh, đánh dấu ${result.cleanedReports} đơn${result.errors ? `, lỗi ${result.errors}` : ''}`)
      }

      if (!batch.hasMore) {
        appendAutoLog('Đã quét hết — không còn đơn cần dọn.')
        persistCleanProgress(true)
        break
      }
      persistCleanProgress(false)
    } catch (e: any) {
      console.error('Auto cleanup round failed:', e)
      storageCleanupError.value = e?.message || 'Lỗi không xác định.'
      appendAutoLog(`Lỗi vòng ${autoRoundCount.value}: ${storageCleanupError.value}`)
      persistCleanProgress(false)
      break
    }

    await sleep(randomDelay())
  }

  isAutoRunning.value = false
}

const pauseAutoCleanup = () => { isAutoPaused.value = true; appendAutoLog(`Tạm dừng (${isDryRun.value ? 'chạy thử' : 'xoá thật'})`); persistCleanProgress(false) }
const resumeAutoCleanup = () => { isAutoPaused.value = false; appendAutoLog(`Tiếp tục (${isDryRun.value ? 'chạy thử' : 'xoá thật'})`) }

// Kết thúc phiên chạy thử — dừng loop, không xoá gì, đặt lại UI về trạng thái ban đầu.
const endDryRunSession = () => {
  autoStopRequested.value = true
  isAutoPaused.value = false
  appendAutoLog('Đã kết thúc phiên chạy thử — không xoá ảnh, không cập nhật Firestore.')
  resetStorageCleanup()
}

// Bắt buộc xác nhận khi admin tắt "Chạy thử" để chuyển sang xoá ảnh thật.
watch(isDryRun, async (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    const { isConfirmed } = await Swal.fire({
      title: 'Tắt chế độ chạy thử?',
      text: 'Bạn đang chuẩn bị XOÁ THẬT ảnh trong Firebase Storage. Ảnh đã xoá sẽ không khôi phục được. Hệ thống không xoá document Firestore, chỉ xoá file ảnh Storage. Tiếp tục?',
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Xoá thật', cancelButtonText: 'Giữ chạy thử', confirmButtonColor: '#dc2626',
    })
    if (!isConfirmed) isDryRun.value = true
  }
})
</script>

<template>
  <div class="p-8 space-y-6">
    <!-- Banner khôi phục tiến trình cũ (sau crash/reload) -->
    <div v-if="resumeBanner" class="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-5 space-y-3">
      <div class="text-amber-400 font-black text-xs uppercase tracking-widest">⚠️ Đã tìm thấy tiến trình cũ ({{ resumeBanner.mode === 'normalize' ? 'Chuẩn hoá' : 'Dọn ảnh' }})</div>
      <div class="text-slate-300 text-xs normal-case font-sans not-italic space-y-0.5">
        <div>Đã quét {{ resumeBanner.scanned }} đơn</div>
        <div v-if="resumeBanner.mode === 'normalize'">Đã chuẩn hoá {{ resumeBanner.normalized }} đơn</div>
        <div v-else>Đã đánh dấu dọn {{ resumeBanner.cleanedReports }} đơn, đã xoá {{ resumeBanner.deletedFiles }} ảnh</div>
        <div>Batch gần nhất: {{ resumeBanner.batchNumber }}</div>
      </div>
      <div class="text-slate-400 text-xs normal-case font-sans not-italic">Bạn muốn tiếp tục từ lần trước không?</div>
      <div class="flex gap-3 flex-wrap">
        <button @click="resumeCleanupFromSaved" class="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-3 rounded-xl transition-all active:scale-95 tracking-widest text-xs uppercase">▶ Tiếp tục từ lần trước</button>
        <button @click="restartCleanupFromScratch" class="bg-slate-700 hover:bg-slate-600 text-white font-black px-5 py-3 rounded-xl transition-all active:scale-95 tracking-widest text-xs uppercase">🔄 Chạy lại từ đầu</button>
        <button @click="discardSavedCleanupProgress" class="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-black px-5 py-3 rounded-xl transition-all active:scale-95 tracking-widest text-xs uppercase border border-slate-700">🗑️ Xoá tiến trình cũ</button>
      </div>
    </div>

    <div>
      <h3 class="text-rose-400 font-black text-base uppercase tracking-widest mb-2">🧹 Dọn ảnh Storage</h3>
      <div class="text-slate-500 text-xs space-y-1 normal-case not-italic font-sans">
        <div>• Mỗi lần chỉ kiểm tra <span class="text-white font-bold">30 đơn</span> — không đọc toàn bộ collection một phát.</div>
        <div>• Job cơ bản (đã xử lý): xoá ảnh nếu status là approved / rejected / collected / paid.</div>
        <div>• Job VIP/ngân hàng/chứng khoán (đã xử lý &amp; &gt; 7 ngày): xoá ảnh.</div>
        <div>• Pending bất kỳ loại: <span class="text-emerald-400 font-bold">KHÔNG xoá</span>.</div>
        <div>• Firestore document giữ nguyên. Chỉ xoá file ảnh trên Storage.</div>
        <div>• Lần đầu dùng: bấm <span class="text-white font-bold">"🧮 Chuẩn hoá tự động"</span> trước để query lọc đúng các đơn cũ chưa dọn (chạy theo lô 30 đơn, có thể tạm dừng).</div>
      </div>
    </div>

    <label class="flex items-center gap-2 text-xs text-slate-400 normal-case font-sans not-italic cursor-pointer w-fit">
      <input type="checkbox" v-model="isDryRun" :disabled="(isAutoRunning && !isAutoPaused) || isNormalizing" class="w-4 h-4 accent-rose-500" />
      ☑ Chạy thử, không xoá thật
    </label>

    <div v-if="!isDryRun" class="flex items-center gap-2 bg-red-600/10 border border-red-500/50 rounded-xl px-4 py-3 w-fit">
      <span class="text-red-400 font-black text-xs uppercase tracking-widest">⚠️ CHẾ ĐỘ XOÁ THẬT</span>
      <span class="text-red-300 text-[11px] normal-case font-sans not-italic">— ảnh sẽ bị xoá vĩnh viễn khỏi Firebase Storage. Tích lại ô trên để quay về chạy thử.</span>
    </div>
    <div v-else class="flex items-center gap-2 text-emerald-500 text-[11px] normal-case font-sans not-italic">
      ✅ Đang ở chế độ chạy thử — không xoá ảnh thật, không cập nhật Firestore.
    </div>

    <div class="flex gap-3 flex-wrap">
      <button @click="startNormalizeAuto" :disabled="isNormalizing || isAutoRunning"
        class="bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-black px-6 py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase">
        {{ isNormalizing ? '⏳ ĐANG CHUẨN HOÁ...' : (storageCleanupError && normalizeBatchCount > 0 ? '🔁 Thử lại batch này' : '🧮 Chuẩn hoá tự động') }}
      </button>

      <button v-if="isNormalizing && !isNormalizePaused" @click="pauseNormalizeAuto"
        class="bg-amber-600 hover:bg-amber-500 text-white font-black px-6 py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase">⏸ Tạm dừng</button>
      <button v-if="isNormalizing && isNormalizePaused" @click="resumeNormalizeAuto"
        class="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase">▶ Tiếp tục</button>

      <button @click="startAutoCleanup" :disabled="isAutoRunning || isNormalizing || isCheckingStorageCleanup || isDeletingStorage"
        class="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black px-8 py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase shadow-[0_0_20px_rgba(225,29,72,0.3)]">
        {{ isAutoRunning ? (isDryRun ? '⏳ ĐANG CHẠY THỬ...' : '⏳ ĐANG XOÁ THẬT...') : (isDryRun ? '🚀 Dọn tự động — chạy thử' : '🔥 Dọn tự động — XOÁ THẬT') }}
      </button>

      <button v-if="isAutoRunning && !isAutoPaused" @click="pauseAutoCleanup"
        class="bg-amber-600 hover:bg-amber-500 text-white font-black px-6 py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase">⏸ Tạm dừng</button>
      <button v-if="isAutoRunning && isAutoPaused" @click="resumeAutoCleanup"
        class="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase">
        {{ isDryRun ? '▶ Tiếp tục chạy thử' : '▶ Tiếp tục xoá thật' }}
      </button>
      <button v-if="isAutoRunning && isDryRun" @click="endDryRunSession"
        class="bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 font-black px-6 py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase border border-rose-800/50">⛔ Kết thúc phiên chạy thử</button>

      <button @click="scanStorageImages" :disabled="isCheckingStorageCleanup || isDeletingStorage || isAutoRunning || isNormalizing"
        class="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-black px-8 py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase">
        {{ isCheckingStorageCleanup ? '⏳ ĐANG KIỂM TRA...' : (storageCleanupError ? '🔁 Thử lại' : (lastCleanupDocId ? '📦 Kiểm tra lô tiếp theo' : '🔍 Kiểm tra 30 đơn đầu tiên')) }}
      </button>

      <button v-if="lastCleanupDocId || storageCleanupResult" @click="resetStorageCleanup"
        :disabled="isCheckingStorageCleanup || isDeletingStorage || isAutoRunning || isNormalizing"
        class="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-400 hover:text-white font-black px-6 py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase border border-slate-700">🔄 Quét lại từ đầu</button>
    </div>

    <!-- Panel tiến trình Chuẩn hoá tự động -->
    <div v-if="isNormalizing || normalizeBatchCount > 0" class="bg-[#0d121f] border border-indigo-800/40 rounded-2xl p-5 space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black uppercase tracking-widest" :class="isNormalizing ? (isNormalizePaused ? 'text-amber-400' : 'text-indigo-400') : 'text-slate-500'">
          {{ isNormalizing ? (isNormalizePaused ? '⏸ Tạm dừng' : '🧮 Đang chuẩn hoá...') : '⏹ Đã dừng' }}
        </span>
        <span class="text-slate-500 text-[10px] uppercase tracking-widest">Batch: <span class="text-white font-black">{{ normalizeBatchCount }}</span></span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-slate-300">{{ normalizeStats.scanned }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">Đã quét</div></div>
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-indigo-400">{{ normalizeStats.normalized }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">Đã chuẩn hoá</div></div>
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-slate-500">{{ normalizeStats.skippedNoImages }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">Bỏ qua không ảnh</div></div>
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-slate-500">{{ normalizeStats.skippedAlreadyNormalized }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">Bỏ qua đã chuẩn hoá</div></div>
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-red-500">{{ normalizeStats.errors }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">Lỗi</div></div>
      </div>
    </div>

    <div v-if="normalizeProgress" class="text-indigo-400 text-sm font-sans normal-case not-italic tracking-normal">{{ normalizeProgress }}</div>
    <div v-if="storageCleanupProgress" class="text-blue-400 text-sm font-sans normal-case not-italic tracking-normal">{{ storageCleanupProgress }}</div>
    <div v-if="storageCleanupError" class="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4 normal-case font-sans not-italic">⚠️ {{ storageCleanupError }}</div>

    <!-- Panel tiến trình Dọn tự động -->
    <div v-if="isAutoRunning || autoRoundCount > 0" class="bg-[#0d121f] border border-rose-800/40 rounded-2xl p-5 space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-xs font-black uppercase tracking-widest" :class="isAutoRunning ? (isAutoPaused ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-500'">
          {{ isAutoRunning ? (isAutoPaused ? (isDryRun ? '⏸ Tạm dừng (chạy thử)' : '⏸ Tạm dừng (xoá thật)') : (isDryRun ? '🧪 ĐANG CHẠY THỬ — KHÔNG XOÁ ẢNH' : '🔥 ĐANG XOÁ THẬT')) : '⏹ Đã dừng' }}
        </span>
        <span class="text-slate-500 text-[10px] uppercase tracking-widest">Vòng: <span class="text-white font-black">{{ autoRoundCount }}</span></span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-slate-300">{{ autoStats.checked }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">Đã kiểm tra</div></div>
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-rose-400">{{ autoStats.deletedImages }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">{{ isDryRun ? 'Sẽ xoá ảnh' : 'Đã xoá ảnh' }}</div></div>
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-blue-400">{{ autoStats.cleanedReports }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">{{ isDryRun ? 'Sẽ đánh dấu đơn' : 'Đã đánh dấu đơn' }}</div></div>
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-slate-500">{{ autoStats.pendingSkipped }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">Bỏ qua pending</div></div>
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-amber-400">{{ autoStats.vipNotOldEnough }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">VIP chưa đủ 7 ngày</div></div>
        <div class="bg-[#111726] rounded-xl p-3 text-center"><div class="text-lg font-black text-red-500">{{ autoStats.errors }}</div><div class="text-slate-500 text-[9px] tracking-widest mt-1 uppercase">Lỗi xoá ảnh</div></div>
      </div>

      <div v-if="autoLogs.length" class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-slate-500 text-[10px] uppercase tracking-widest">Log gần nhất</span>
          <button @click="clearAutoLogs" class="text-slate-500 hover:text-white text-[10px] uppercase tracking-widest font-bold">Xoá log</button>
        </div>
        <div class="bg-black/40 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1 font-mono">
          <div v-for="(line, idx) in autoLogs" :key="idx" class="text-slate-400 text-[10px] normal-case not-italic">{{ line }}</div>
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="storageCleanupResult" class="space-y-6">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-4 text-center"><div class="text-2xl font-black text-slate-300">{{ storageCleanupResult.checkedReports }}</div><div class="text-slate-500 text-[10px] tracking-widest mt-1 uppercase">Đã kiểm tra</div></div>
          <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-4 text-center"><div class="text-2xl font-black text-blue-400">{{ storageCleanupResult.basicReportCount }}</div><div class="text-slate-500 text-[10px] tracking-widest mt-1 uppercase">Job cơ bản</div></div>
          <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-4 text-center"><div class="text-2xl font-black text-amber-400">{{ storageCleanupResult.vipReportCount }}</div><div class="text-slate-500 text-[10px] tracking-widest mt-1 uppercase">VIP &gt; 7 ngày</div></div>
          <div class="bg-[#0d121f] border border-slate-800 rounded-2xl p-4 text-center"><div class="text-2xl font-black text-slate-500">{{ storageCleanupResult.pendingSkipped }}</div><div class="text-slate-500 text-[10px] tracking-widest mt-1 uppercase">Pending bỏ qua</div></div>
          <div class="bg-[#0d121f] border border-rose-800/50 rounded-2xl p-4 text-center"><div class="text-2xl font-black text-rose-400">{{ storageCleanupResult.totalImageCount }}</div><div class="text-slate-500 text-[10px] tracking-widest mt-1 uppercase">Ảnh sẽ xoá</div></div>
        </div>

        <div v-if="storageCleanupResult.totalImageCount === 0" class="text-center text-slate-500 text-sm italic normal-case font-sans py-2">
          Không có ảnh nào cần xoá trong lô này.
          <span v-if="storageCleanupResult.hasMore" class="block mt-1 text-blue-400 not-italic font-bold">Bấm "Kiểm tra lô tiếp theo" để tiếp tục.</span>
          <span v-else class="block mt-1 text-emerald-400 not-italic font-bold">✅ Đã hết collection.</span>
        </div>

        <button v-if="storageCleanupResult.totalImageCount > 0" @click="confirmDeleteImages" :disabled="isDeletingStorage || isCheckingStorageCleanup"
          class="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all active:scale-95 tracking-widest text-sm uppercase shadow-[0_0_20px_rgba(220,38,38,0.4)]">
          {{ isDeletingStorage ? '⏳ ĐANG XOÁ ẢNH...' : `🗑️ Xác nhận xoá ảnh lô này (${storageCleanupResult.totalImageCount} ảnh)` }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
