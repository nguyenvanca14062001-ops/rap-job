import { ref } from 'vue'
import { collection, query, where, orderBy, limit, onSnapshot, getDocs, getCountFromServer, startAfter, documentId } from 'firebase/firestore'
import type { Firestore, QueryConstraint, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore'

// ============================================================================
// NGUỒN ĐƠN CHO 2 TAB ADMIN "APP NGÂN HÀNG" + "JOB KHÁC" — CHỈ ĐỌC, không ghi / sửa / xoá đơn nào.
// Trước đây 2 tab lọc ở client trên 1 listener chung `reports` có giới hạn: chờ duyệt = 300 đơn đầu theo MÃ ĐƠN (không theo thời
// gian), tất cả = 200 đơn mới nhất của mọi job → tổng đơn chờ mọi job vượt 300 là đơn VIP bị cắt trước khi kịp lọc, badge về 0.
// Giờ:
// - Mỗi nhóm jobId (VIP / job thường / jobId lạ phát hiện khi quét) có listener riêng cho từng trạng thái của bộ lọc, tải 500 đơn
//   mỗi trang (TẢI THÊM). Chờ duyệt: không sắp xếp (không cần index, lấy cả đơn thiếu createdAt). Lịch sử: mới nhất trước — cần
//   composite index; chưa có index (failed-precondition) thì tự chuyển truy vấn không sắp xếp và giữ link tạo index để báo Admin.
// - Đếm trên server (getCountFromServer, không giới hạn) từng listener + tổng đơn theo trạng thái → biết còn bao nhiêu đơn chưa tải
//   và bao nhiêu đơn KHÔNG thuộc nhóm jobId nào (thiếu jobId = đơn trước 20/05/2026, hoặc jobId lạ).
// - Còn đơn ngoài nhóm → quét toàn bộ đơn của trạng thái đó theo trang (getDocs + con trỏ, đến hết): jobId lạ → thêm listener
//   riêng; thiếu jobId → listener theo mã đơn. Chờ duyệt: tự quét; lịch sử (có thể rất nhiều đơn): Admin bấm quét.
// - Lỗi listener / lỗi đếm / mất kết nối đều được báo trong `state` — không bao giờ lặng lẽ hiện 0 đơn.
// ============================================================================

export type ReportMode = 'pending' | 'all' | 'approved' | 'rejected'
export type ReportTab = 'app' | 'other'
type SourceGroup = ReportTab | 'extra'

const PAGE_SIZE = 500
const SWEEP_PAGE = 500
// Firestore: tối đa 30 giá trị cho 1 điều kiện 'in'
const IN_LIMIT = 30
// Đếm lại sau khi danh sách thay đổi (gộp nhiều thay đổi liên tiếp), tối thiểu cách nhau 15 giây; ngoài ra đếm lại mỗi 90 giây
const RECOUNT_DEBOUNCE_MS = 4000
const RECOUNT_MIN_GAP_MS = 15000
const RECOUNT_INTERVAL_MS = 90000
// Thấy đơn chờ ngoài nhóm jobId: đếm lại sau 3 giây để chắc không phải lệch do đơn mới vào giữa 2 lần đếm, rồi mới tự quét
const CONFIRM_DELAY_MS = 3000
const AUTO_SWEEP_GAP_MS = 5 * 60 * 1000
// Đơn thiếu jobId theo dõi realtime tối đa 40 listener × 30 đơn; phần dư giữ dữ liệu lúc quét
const MAX_DOC_LISTENERS = 40

const MODE_STATUSES: Record<ReportMode, (string | null)[]> = {
  pending: ['pending'],
  approved: ['approved', 'collected'],
  rejected: ['rejected'],
  all: [null],
}

interface SourceState {
  key: string
  group: SourceGroup
  ids: string[]
  status: string | null
  ordered: boolean
  fallback: boolean
  undated: boolean
  limit: number
  docs: any[]
  ready: boolean
  fromCache: boolean
  error: string
  count: number | null
  countError: string
  indexUrl: string
  // Số lần đếm liên tiếp thấy server nhiều hơn listener đã hết dữ liệu (nghi đơn thiếu createdAt)
  undatedHits: number
}

export interface TabSourceSummary {
  ready: boolean
  // Đã có số đếm trên server cho mọi listener của tab
  checked: boolean
  loaded: number
  // Đơn đã tải + số còn trên server chưa tải (null = không biết vì không đếm được)
  total: number | null
  remaining: number | null
  complete: boolean
  canLoadMore: boolean
  errors: string[]
  countErrors: string[]
  fallback: boolean
  undated: boolean
  fromCache: boolean
  indexUrls: string[]
}

export interface ReportSweepState {
  state: 'idle' | 'running' | 'done' | 'stopped' | 'error'
  scanned: number
  toScan: number | null
  found: number
  foundApp: number
  error: string
}

export interface ReportSourcesState {
  active: boolean
  mode: ReportMode
  ready: boolean
  tabs: Record<ReportTab, TabSourceSummary>
  // Tổng đơn của trạng thái đang lọc (mọi job) và số đơn trong đó nằm ngoài mọi nhóm jobId mà chưa tải (null = chưa biết)
  statusTotal: number | null
  unknown: number | null
  totalsError: string
  countsAt: number
  sweep: ReportSweepState
  extraJobIds: string[]
  undocCount: number
  undocStatic: number
  undocError: string
  sources: { key: string; status: string; ordered: boolean; fallback: boolean; undated: boolean; limit: number; loaded: number; count: number | null; error: string }[]
}

const emptyTab = (): TabSourceSummary => ({
  ready: false, checked: false, loaded: 0, total: null, remaining: null, complete: false, canLoadMore: false,
  errors: [], countErrors: [], fallback: false, undated: false, fromCache: false, indexUrls: [],
})
const idleSweep = (): ReportSweepState => ({ state: 'idle', scanned: 0, toScan: null, found: 0, foundApp: 0, error: '' })

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
const errText = (e: any) => `${e?.code || 'lỗi'}: ${e?.message || e}`
// Firestore báo thiếu index kèm link tạo đúng index đó trong Firebase Console
const indexUrlOf = (message: string) => (message.match(/https:\/\/console\.firebase\.google\.com\S+/)?.[0] || '').replace(/[).,]+$/, '')
// createdAt chưa có (serverTimestamp đang ghi / đơn cũ thiếu ngày tạo) → xếp lên đầu, giống listener cũ của AdminView
const timeOf = (t: any) => t?.toDate ? t.toDate().getTime() : (t ? new Date(t).getTime() : Date.now() + 15000)
// 1 đơn có thể có mặt ở 2 listener lúc đổi trạng thái — giữ bản "tiến xa" hơn (pending → approved/rejected → collected)
const statusRank = (s: any) => s === 'pending' ? 0 : s === 'collected' ? 2 : 1

export function useAdminReportSources(opts: {
  db: Firestore
  appJobIds: string[]
  otherJobIds: string[]
  // Job có tab duyệt riêng (BÌNH LUẬN DẠO / SEEDING) — chỉ đếm để đối soát, không tải vào 2 tab này
  hiddenJobIds: string[]
  isAppJob: (r: any) => boolean
  onDocs: (list: any[], ready: boolean) => void
}) {
  const reportsCol = collection(opts.db, 'reports')
  const state = ref<ReportSourcesState>({
    active: false, mode: 'pending', ready: false, tabs: { app: emptyTab(), other: emptyTab() },
    statusTotal: null, unknown: null, totalsError: '', countsAt: 0, sweep: idleSweep(),
    extraJobIds: [], undocCount: 0, undocStatic: 0, undocError: '', sources: [],
  })

  let mode: ReportMode = 'pending'
  let running = false
  // Tăng mỗi lần start / stop — kết quả của listener, lượt đếm, lượt quét cũ bị bỏ qua
  let generation = 0
  let sources: SourceState[] = []
  const unsubs = new Map<string, () => void>()
  let docsDirty = true

  // Phát hiện khi quét — giữ suốt phiên Admin (đổi bộ lọc trạng thái không mất)
  const extraIds = new Set<string>()
  const extraChunks: string[][] = []
  const undoc = new Map<string, any>()
  let undocWatched = new Set<string>()
  let undocUnsubs: (() => void)[] = []
  let undocError = ''

  let statusTotal: number | null = null
  let hiddenTotal: number | null = null
  let totalsError = ''
  let countsAt = 0
  let unknown: number | null = null
  let confirmUnknown = false
  let lastAutoSweepAt = 0
  let sweepInfo: ReportSweepState = idleSweep()
  let sweepStopRequested = false
  let recountTimer: ReturnType<typeof setTimeout> | null = null
  let intervalTimer: ReturnType<typeof setInterval> | null = null
  let lastRecountAt = 0
  let recounting = false
  let recountAgain = false

  const statuses = () => MODE_STATUSES[mode]
  const statusMatches = (r: any) => mode === 'all' || statuses().includes(r?.status)
  const statusWhere = (s: string | null): QueryConstraint[] => s ? [where('status', '==', s)] : []
  const tabOf = (r: any): ReportTab | null => opts.isAppJob(r) ? 'app' : opts.hiddenJobIds.includes(r?.jobId) ? null : 'other'
  // jobId lạ: tab theo phân loại đơn đầu tiên đã tải (cùng jobId thì cùng loại job)
  const tabOfSource = (s: SourceState): ReportTab => s.group !== 'extra' ? s.group : (s.docs.length ? tabOf(s.docs[0]) ?? 'other' : 'other')

  const newSource = (key: string, group: SourceGroup, ids: string[], status: string | null): SourceState => ({
    key, group, ids, status, ordered: mode !== 'pending', fallback: false, undated: false, limit: PAGE_SIZE,
    docs: [], ready: false, fromCache: false, error: '', count: null, countError: '', indexUrl: '', undatedHits: 0,
  })
  const sourcesFor = (group: SourceGroup, idChunks: string[][], prefix: string, offset = 0) =>
    idChunks.flatMap((ids, i) => statuses().map(status => newSource(`${prefix}${offset + i}:${status ?? 'all'}`, group, ids, status)))

  // ----------------------------------------------------------------------------
  // LISTENER THEO NHÓM jobId
  // ----------------------------------------------------------------------------
  const subscribe = (s: SourceState) => {
    unsubs.get(s.key)?.()
    const gen = generation
    const ordered = s.ordered && !s.fallback && !s.undated
    const q = query(reportsCol, where('jobId', 'in', s.ids), ...statusWhere(s.status), ...(ordered ? [orderBy('createdAt', 'desc')] : []), limit(s.limit))
    // includeMetadataChanges: biết được lúc dữ liệu chỉ là bản cache khi mất kết nối (fromCache) → báo, không coi là đã đủ
    const unsub = onSnapshot(q, { includeMetadataChanges: true }, snap => {
      if (gen !== generation) return
      const changes = snap.docChanges()
      if (!s.ready || changes.length) {
        if (s.ready && changes.some(c => c.type !== 'modified')) scheduleRecount()
        // Listener cuối cùng vừa có dữ liệu lần đầu → đếm lại ngay để đối chiếu (lượt đếm lúc bắt đầu có thể xong trước)
        else if (!s.ready && sources.every(x => x === s || x.ready)) scheduleRecount(300, true)
        s.docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        docsDirty = true
      }
      s.ready = true
      s.fromCache = snap.metadata.fromCache
      s.error = ''
      publish()
    }, err => {
      if (gen !== generation) return
      if (ordered && err.code === 'failed-precondition') {
        console.warn(`[Admin] Chưa có composite index cho truy vấn ${s.key} — dùng truy vấn dự phòng không sắp xếp:`, err.message)
        s.fallback = true
        s.indexUrl = indexUrlOf(err.message)
        subscribe(s)
        publish()
        return
      }
      console.error(`[Admin] Lỗi tải đơn (${s.key}):`, err)
      s.error = errText(err)
      s.ready = true
      publish()
    })
    unsubs.set(s.key, unsub)
  }

  // Lịch sử xếp theo createdAt bỏ qua đơn THIẾU createdAt: listener đã hết dữ liệu (chưa đầy giới hạn) mà server vẫn đếm nhiều hơn
  // ở 2 lần đếm liên tiếp (lần đầu có thể chỉ lệch vì đơn mới vào giữa chừng) → chuyển sang truy vấn không sắp xếp với giới hạn
  // ≥ số đếm để lấy đủ cả các đơn đó. Chỉ gọi ngay sau khi đếm xong.
  const checkUndated = () => {
    let suspect = false
    for (const s of sources) {
      if (!s.ordered || s.fallback || s.undated || !s.ready || s.error || s.fromCache || s.count == null || s.countError) { s.undatedHits = 0; continue }
      if (s.docs.length < s.limit && s.count > s.docs.length) {
        s.undatedHits++
        if (s.undatedHits < 2) { suspect = true; continue }
        s.undated = true
        s.limit = Math.max(s.limit, s.count + 50)
        subscribe(s)
      } else s.undatedHits = 0
    }
    if (suspect) scheduleRecount(CONFIRM_DELAY_MS, true)
  }

  // ----------------------------------------------------------------------------
  // ĐẾM TRÊN SERVER
  // ----------------------------------------------------------------------------
  const countOf = async (constraints: QueryConstraint[]) => (await getCountFromServer(query(reportsCol, ...constraints))).data().count

  const scheduleRecount = (delay = RECOUNT_DEBOUNCE_MS, force = false) => {
    if (!running) return
    if (recountTimer && !force) return
    if (recountTimer) clearTimeout(recountTimer)
    const wait = force ? delay : Math.max(delay, lastRecountAt + RECOUNT_MIN_GAP_MS - Date.now())
    recountTimer = setTimeout(() => { recountTimer = null; void recount() }, Math.max(0, wait))
  }

  const recount = async () => {
    if (!running) return
    if (recounting) { recountAgain = true; return }
    recounting = true
    const gen = generation
    lastRecountAt = Date.now()
    try {
      const perSource = sources.map(s => countOf([where('jobId', 'in', s.ids), ...statusWhere(s.status)]).then(
        n => { if (gen === generation) { s.count = n; s.countError = '' } },
        e => { if (gen === generation) { s.countError = errText(e); console.error(`[Admin] Lỗi đếm đơn (${s.key}):`, e) } },
      ))
      const hidden = chunk(opts.hiddenJobIds, IN_LIMIT).flatMap(ids => statuses().map(st => countOf([where('jobId', 'in', ids), ...statusWhere(st)])))
      const totals = statuses().map(st => countOf(statusWhere(st)))
      const [hiddenRes, totalRes] = await Promise.all([Promise.allSettled(hidden), Promise.allSettled(totals), Promise.all(perSource)])
      if (gen !== generation) return
      const failed = [...hiddenRes, ...totalRes].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
      const sum = (list: PromiseSettledResult<number>[]) => list.reduce((n, r) => n + (r.status === 'fulfilled' ? r.value : 0), 0)
      if (failed) {
        console.error('[Admin] Lỗi đếm tổng đơn theo trạng thái:', failed.reason)
        totalsError = errText(failed.reason)
        statusTotal = null
        hiddenTotal = null
      } else {
        totalsError = ''
        statusTotal = sum(totalRes)
        hiddenTotal = sum(hiddenRes)
      }
      countsAt = Date.now()
      checkUndated()
      evaluateUnknown()
    } finally {
      if (gen === generation) {
        recounting = false
        publish()
        if (recountAgain) { recountAgain = false; scheduleRecount(0, true) }
      }
    }
  }

  // Đơn của trạng thái đang lọc không thuộc nhóm jobId nào (VIP / thường / Threads / jobId lạ đã phát hiện) và chưa tải
  const evaluateUnknown = () => {
    if (statusTotal == null || hiddenTotal == null || sources.some(s => s.count == null || s.countError)) { unknown = null; return }
    const known = hiddenTotal + sources.reduce((n, s) => n + (s.count || 0), 0)
    const undocMatching = [...undoc.values()].filter(statusMatches).length
    unknown = Math.max(0, statusTotal - known - undocMatching)
    if (unknown > 0 && mode === 'pending' && sweepInfo.state !== 'running') {
      if (!confirmUnknown) { confirmUnknown = true; scheduleRecount(CONFIRM_DELAY_MS, true) }
      else if (Date.now() - lastAutoSweepAt >= AUTO_SWEEP_GAP_MS) { confirmUnknown = false; lastAutoSweepAt = Date.now(); void sweep() }
    } else confirmUnknown = false
  }

  // ----------------------------------------------------------------------------
  // QUÉT ĐƠN NGOÀI NHÓM jobId — đọc lần lượt mọi đơn của trạng thái đang lọc theo thứ tự mã đơn (500 đơn / lượt) đến hết
  // ----------------------------------------------------------------------------
  const sweep = async () => {
    if (!running || sweepInfo.state === 'running') return
    const gen = generation
    const known = new Set([...opts.appJobIds, ...opts.otherJobIds, ...opts.hiddenJobIds, ...extraIds])
    const foundExtra = new Set<string>()
    const foundUndoc: any[] = []
    sweepStopRequested = false
    sweepInfo = { ...idleSweep(), state: 'running', toScan: statusTotal }
    publish()
    try {
      for (const st of statuses()) {
        let cursor: QueryDocumentSnapshot | null = null
        while (!sweepStopRequested) {
          const page: QuerySnapshot = await getDocs(query(reportsCol, ...statusWhere(st), ...(cursor ? [startAfter(cursor)] : []), limit(SWEEP_PAGE)))
          if (gen !== generation) return
          sweepInfo.scanned += page.size
          for (const d of page.docs) {
            const jobId = d.get('jobId')
            if (typeof jobId === 'string' && jobId && known.has(jobId)) continue
            const data = { id: d.id, ...d.data() }
            if (typeof jobId === 'string' && jobId) foundExtra.add(jobId)
            else foundUndoc.push(data)
            sweepInfo.found++
            if (opts.isAppJob(data)) sweepInfo.foundApp++
          }
          publish()
          if (page.size < SWEEP_PAGE) break
          cursor = page.docs[page.docs.length - 1] ?? null
        }
        if (sweepStopRequested) break
      }
      if (gen !== generation) return
      // Có cả khi bị dừng giữa chừng: đơn tìm được tới lúc đó vẫn được đưa vào danh sách
      const newIds = [...foundExtra].filter(id => !extraIds.has(id))
      if (newIds.length) addExtraIds(newIds)
      if (foundUndoc.length) addUndoc(foundUndoc)
      sweepInfo.state = sweepStopRequested ? 'stopped' : 'done'
    } catch (e) {
      if (gen !== generation) return
      console.error('[Admin] Lỗi quét đơn ngoài nhóm jobId:', e)
      sweepInfo.state = 'error'
      sweepInfo.error = errText(e)
    } finally {
      if (gen === generation) {
        docsDirty = true
        publish()
        scheduleRecount(0, true)
      }
    }
  }

  // jobId lạ → listener riêng như nhóm VIP / thường (realtime, gồm cả đơn mới của jobId đó sau này)
  const addExtraIds = (ids: string[]) => {
    ids.forEach(id => extraIds.add(id))
    const fresh = chunk(ids, IN_LIMIT)
    const created = sourcesFor('extra', fresh, 'extra', extraChunks.length)
    extraChunks.push(...fresh)
    sources.push(...created)
    created.forEach(subscribe)
  }

  // Đơn thiếu jobId → listener theo mã đơn (realtime: duyệt / từ chối / xoá cập nhật ngay). Đơn đang chờ được theo dõi trước.
  const addUndoc = (list: any[]) => {
    list.forEach(r => undoc.set(r.id, r))
    watchUndoc(list.map(r => r.id))
  }
  const watchUndoc = (ids: string[]) => {
    const gen = generation
    const fresh = ids.filter(id => !undocWatched.has(id))
      .sort((a, b) => Number(undoc.get(b)?.status === 'pending') - Number(undoc.get(a)?.status === 'pending'))
    for (const c of chunk(fresh, IN_LIMIT)) {
      if (undocUnsubs.length >= MAX_DOC_LISTENERS) break
      c.forEach(id => undocWatched.add(id))
      undocUnsubs.push(onSnapshot(query(reportsCol, where(documentId(), 'in', c)), snap => {
        if (gen !== generation) return
        const present = new Set(snap.docs.map(d => d.id))
        c.forEach(id => { if (!present.has(id)) undoc.delete(id) })
        snap.docs.forEach(d => undoc.set(d.id, { id: d.id, ...d.data() }))
        undocError = ''
        docsDirty = true
        publish()
      }, err => {
        if (gen !== generation) return
        console.error('[Admin] Lỗi theo dõi đơn thiếu jobId:', err)
        undocError = errText(err)
        publish()
      }))
    }
  }

  // ----------------------------------------------------------------------------
  // GỘP + TÓM TẮT CHO GIAO DIỆN
  // ----------------------------------------------------------------------------
  const tabSummary = (tab: ReportTab, list: any[]): TabSourceSummary => {
    const own = sources.filter(s => tabOfSource(s) === tab)
    let remaining: number | null = 0
    for (const s of own) {
      if (s.count != null && !s.countError) remaining = remaining == null ? null : remaining + Math.max(0, s.count - s.docs.length)
      else if (!s.ready || s.docs.length >= s.limit) remaining = null
    }
    const loaded = list.filter(r => tabOf(r) === tab).length
    const ready = own.every(s => s.ready)
    const errors = [...new Set([...own.map(s => s.error), undocError].filter(Boolean))]
    const countErrors = [...new Set([...own.map(s => s.countError), totalsError].filter(Boolean))]
    const checked = countsAt > 0 && own.every(s => s.count != null || !!s.countError)
    const fromCache = own.some(s => s.fromCache)
    return {
      ready, checked, loaded, remaining,
      total: remaining == null ? null : loaded + remaining,
      complete: ready && checked && !errors.length && !countErrors.length && !fromCache && remaining === 0 && unknown === 0 && sweepInfo.state !== 'running',
      canLoadMore: own.some(s => s.ready && !s.error && s.docs.length >= s.limit),
      errors, countErrors, fromCache,
      fallback: own.some(s => s.fallback),
      undated: own.some(s => s.undated),
      indexUrls: [...new Set(own.map(s => s.indexUrl).filter(Boolean))],
    }
  }

  let lastList: any[] = []
  const publish = () => {
    const ready = running && sources.every(s => s.ready)
    if (running && docsDirty) {
      docsDirty = false
      const merged = new Map<string, any>()
      const add = (r: any) => {
        const cur = merged.get(r.id)
        if (!cur || statusRank(r.status) > statusRank(cur.status)) merged.set(r.id, r)
      }
      sources.forEach(s => s.docs.forEach(add))
      undoc.forEach(r => { if (statusMatches(r)) add(r) })
      lastList = [...merged.values()].sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt))
      opts.onDocs(lastList, ready)
    } else if (running && ready && !state.value.ready) {
      opts.onDocs(lastList, ready)
    }
    state.value = {
      active: running, mode, ready,
      tabs: { app: tabSummary('app', lastList), other: tabSummary('other', lastList) },
      statusTotal, unknown, totalsError, countsAt,
      sweep: { ...sweepInfo },
      extraJobIds: [...extraIds],
      undocCount: undoc.size,
      undocStatic: [...undoc.keys()].filter(id => !undocWatched.has(id)).length,
      undocError,
      sources: sources.map(s => ({
        key: s.key, status: s.status ?? 'all', ordered: s.ordered && !s.fallback && !s.undated, fallback: s.fallback, undated: s.undated,
        limit: s.limit, loaded: s.docs.length, count: s.countError ? null : s.count, error: s.error || s.countError,
      })),
    }
  }

  // ----------------------------------------------------------------------------
  // ĐIỀU KHIỂN
  // ----------------------------------------------------------------------------
  const stop = () => {
    if (running) generation++
    running = false
    unsubs.forEach(unsub => unsub())
    unsubs.clear()
    undocUnsubs.forEach(unsub => unsub())
    undocUnsubs = []
    undocWatched = new Set()
    if (recountTimer) { clearTimeout(recountTimer); recountTimer = null }
    if (intervalTimer) { clearInterval(intervalTimer); intervalTimer = null }
    sweepStopRequested = true
    recounting = false
    recountAgain = false
    state.value = { ...state.value, active: false }
  }

  const start = (m: ReportMode) => {
    stop()
    running = true
    mode = m
    generation++
    statusTotal = null
    hiddenTotal = null
    totalsError = ''
    countsAt = 0
    unknown = null
    confirmUnknown = false
    sweepInfo = idleSweep()
    docsDirty = true
    lastList = []
    sources = [
      ...sourcesFor('app', chunk(opts.appJobIds, IN_LIMIT), 'app'),
      ...sourcesFor('other', chunk(opts.otherJobIds, IN_LIMIT), 'other'),
      ...sourcesFor('extra', extraChunks, 'extra'),
    ]
    sources.forEach(subscribe)
    watchUndoc([...undoc.keys()])
    void recount()
    intervalTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (Date.now() - lastRecountAt >= RECOUNT_INTERVAL_MS - 1000) void recount()
    }, RECOUNT_INTERVAL_MS)
    publish()
  }

  // Tải thêm 500 đơn cho các listener của tab đang đầy giới hạn
  const loadMore = (tab: ReportTab) => {
    if (!running) return
    for (const s of sources) {
      if (tabOfSource(s) !== tab || !s.ready || s.error || s.docs.length < s.limit) continue
      s.limit += PAGE_SIZE
      subscribe(s)
    }
    publish()
  }

  return {
    state,
    start,
    stop,
    loadMore,
    retry: () => start(mode),
    refreshCounts: () => scheduleRecount(0, true),
    sweep: () => { void sweep() },
    stopSweep: () => { sweepStopRequested = true },
  }
}
