<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '@/firebase'
import { onAuthStateChanged, signOut } from "firebase/auth"
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, increment, limit, where, getDocs, addDoc, serverTimestamp, Timestamp } from "firebase/firestore"
import Swal from 'sweetalert2'

const reports = ref<any[]>([])
const withdrawals = ref<any[]>([])
const dailyNotes = ref<any[]>([])
const usersMap = ref<Record<string, any>>({})
const isLoading = ref(true)
const isCheckingAuth = ref(true)
const router = useRouter()

const activeTab = ref('app_jobs')
const siteFilter = ref('all')
const statusFilter = ref('pending')

const selectedImage = ref<string | null>(null)
const openImage = (img: string) => { selectedImage.value = img }
const closeImage = () => { selectedImage.value = null }

const selectedReportId = ref<string | null>(null)
const showRejectPopup = ref(false)
const rejectReason = ref('')

// ============================================================================
// 1. DASHBOARD THỐNG KÊ
// ============================================================================
const statsTodayTotal = ref(0)
const statsTodayAppTotal = ref(0)
const statsAppBreakdown = ref<Record<string, { today: number }>>({
  'CK SỐ 1 (Kafi)': { today: 0 },
  'CK SỐ 2 (DNSE)': { today: 0 },
  'CK SỐ 3 (KIS)': { today: 0 },
  'MSB BANK': { today: 0 },
  'VP BANK': { today: 0 },
  'TP BANK': { today: 0 }
})
const isStatsLoading = ref(false)

const loadDashboardStats = async () => {
  isStatsLoading.value = true;
  const site = siteFilter.value;
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    statsTodayTotal.value = 0;
    statsTodayAppTotal.value = 0;
    Object.keys(statsAppBreakdown.value).forEach(k => statsAppBreakdown.value[k].today = 0);
    // Khi lọc theo site cụ thể: lấy toàn bộ docs của site đó (ít), filter ngày client-side
    // Khi 'all': dùng where createdAt >= startOfDay nhưng thêm limit để tránh đọc vô hạn
    const qStats = site !== 'all'
      ? query(collection(db, "reports"), where("site", "==", site), limit(500))
      : query(collection(db, "reports"), where("createdAt", ">=", Timestamp.fromDate(startOfDay)), limit(500));
    const snap = await getDocs(qStats);
    snap.forEach(doc => {
      const data = doc.data();
      if (site !== 'all') {
        const t = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
        if (t < startOfDay) return;
      }
      if (data.status === 'approved' || data.status === 'collected') {
        statsTodayTotal.value++;
        if (isAppJob(data.jobName)) {
          statsTodayAppTotal.value++;
          const nameLower = (data.jobName || '').toLowerCase();
          if (nameLower.includes('chứng khoán số 1') || nameLower.includes('kafi')) statsAppBreakdown.value['CK SỐ 1 (Kafi)'].today++;
          else if (nameLower.includes('chứng khoán số 2') || nameLower.includes('dnse')) statsAppBreakdown.value['CK SỐ 2 (DNSE)'].today++;
          else if (nameLower.includes('chứng khoán số 3') || nameLower.includes('kis')) statsAppBreakdown.value['CK SỐ 3 (KIS)'].today++;
          else if (nameLower.includes('msb')) statsAppBreakdown.value['MSB BANK'].today++;
          else if (nameLower.includes('vpbank') || nameLower.includes('vp bank')) statsAppBreakdown.value['VP BANK'].today++;
          else if (nameLower.includes('tpbank') || nameLower.includes('tp bank')) statsAppBreakdown.value['TP BANK'].today++;
        }
      }
    });
  } catch (err) {
    console.error("Lỗi tải thống kê: ", err);
  } finally {
    isStatsLoading.value = false;
  }
}

const updateLocalStatsOnApprove = (jobName: string) => {
  statsTodayTotal.value++;
  if (isAppJob(jobName)) {
    statsTodayAppTotal.value++;
    const nameLower = (jobName || '').toLowerCase();
    if (nameLower.includes('chứng khoán số 1') || nameLower.includes('kafi')) statsAppBreakdown.value['CK SỐ 1 (Kafi)'].today++;
    else if (nameLower.includes('chứng khoán số 2') || nameLower.includes('dnse')) statsAppBreakdown.value['CK SỐ 2 (DNSE)'].today++;
    else if (nameLower.includes('chứng khoán số 3') || nameLower.includes('kis')) statsAppBreakdown.value['CK SỐ 3 (KIS)'].today++;
    else if (nameLower.includes('msb')) statsAppBreakdown.value['MSB BANK'].today++;
    else if (nameLower.includes('vpbank') || nameLower.includes('vp bank')) statsAppBreakdown.value['VP BANK'].today++;
    else if (nameLower.includes('tpbank') || nameLower.includes('tp bank')) statsAppBreakdown.value['TP BANK'].today++;
  }
}

// ============================================================================
// 2. SỔ TAY ĐỐI SOÁT HÀNG NGÀY
// ============================================================================
const saveDailyNote = async () => {
  const now = new Date();
  const dateStr = `Ngày ${now.getDate()}/${now.getMonth() + 1}`;
  let detailArr: string[] = [];
  for (const [name, val] of Object.entries(statsAppBreakdown.value)) {
    if (val.today > 0) detailArr.push(`${val.today} ${name}`);
  }
  const finalContent = detailArr.length > 0 ? detailArr.join(' - ') : "Chưa có đơn app nào.";
  const { isConfirmed } = await Swal.fire({
    title: 'CHỐT SỔ HÔM NAY?',
    text: `${dateStr}: ${finalContent}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'LƯU VÀO SỔ TAY',
    confirmButtonColor: '#10b981'
  });
  if (isConfirmed) {
    try {
      await addDoc(collection(db, "admin_notes"), {
        dateLabel: dateStr,
        content: finalContent,
        totalToday: statsTodayTotal.value,
        createdAt: serverTimestamp()
      });
      Swal.fire('Đã Lưu!', 'Dữ liệu đã được cất vào sổ tay bên dưới.', 'success');
    } catch (e) { alert("Lỗi lưu note: " + e); }
  }
}

const deleteNote = async (id: string) => {
  if (confirm("Xóa dòng note này?")) {
    await deleteDoc(doc(db, "admin_notes", id));
  }
}

// ============================================================================
// 3. TÌM KIẾM THEO USERNAME / SĐT
// ============================================================================
const searchQuery = ref('')

const handleSearch = () => {
  const text = searchQuery.value.trim();
  if (!text) { loadData(statusFilter.value); return; }

  isLoading.value = true;
  if (unsubReports) unsubReports();
  if (unsubWithdrawals) unsubWithdrawals();

  let matchedUids: string[] = [];
  const lowerText = text.toLowerCase();
  for (const uid in usersMap.value) {
    const user = usersMap.value[uid];
    const uname = user.username ? String(user.username).toLowerCase() : '';
    const fname = user.fullName ? String(user.fullName).toLowerCase() : '';
    if (uname.includes(lowerText) || fname.includes(lowerText)) matchedUids.push(uid);
  }

  const limitedUids = matchedUids.slice(0, 10);
  let qReports;
  if (limitedUids.length > 0) {
    qReports = query(collection(db, "reports"), where("uid", "in", limitedUids), limit(100));
  } else {
    qReports = query(collection(db, "reports"), where("phoneRef", "==", text), limit(50));
  }

  unsubReports = onSnapshot(qReports, (snapshot) => {
    let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime();
    data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
    reports.value = data;

    let uidsToSearchWith = limitedUids;
    if (uidsToSearchWith.length === 0 && data.length > 0) uidsToSearchWith = [data[0].uid];

    if (uidsToSearchWith.length > 0) {
      const validUids = uidsToSearchWith.slice(0, 10);
      const qWith = query(collection(db, "withdrawals"), where("uid", "in", validUids));
      unsubWithdrawals = onSnapshot(qWith, (snapWith) => {
        let wData = snapWith.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        wData.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
        withdrawals.value = wData;
      });
    } else {
      withdrawals.value = [];
    }
    isLoading.value = false;
  }, (error) => {
    alert("LỖI TÌM KIẾM: " + error.message);
    isLoading.value = false;
  });
}

// ============================================================================
// 4. DUYỆT HÀNG LOẠT (BULK APPROVE)
// ============================================================================
const selectedOtherJobs = ref<string[]>([])

watch(activeTab, () => { selectedOtherJobs.value = [] })

const isAllOtherJobsSelected = computed(() => {
  const pendingJobs = filteredOtherReports.value.filter(r => r.status === 'pending')
  return pendingJobs.length > 0 && selectedOtherJobs.value.length === pendingJobs.length
})

const toggleAllOtherJobs = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    selectedOtherJobs.value = filteredOtherReports.value.filter(r => r.status === 'pending').map(r => r.id)
  } else {
    selectedOtherJobs.value = []
  }
}

const bulkApproveOtherJobs = async () => {
  if (selectedOtherJobs.value.length === 0) return
  const { isConfirmed } = await Swal.fire({
    title: `DUYỆT ${selectedOtherJobs.value.length} ĐƠN?`,
    text: "Bạn có chắc chắn muốn duyệt và cộng tiền cho tất cả các đơn đã chọn?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonText: 'HỦY',
    confirmButtonText: 'DUYỆT LUÔN 🚀'
  });
  if (isConfirmed) {
    try {
      Swal.fire({ title: 'ĐANG XỬ LÝ...', text: 'Vui lòng không đóng trang lúc này!', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } })
      for (const reportId of selectedOtherJobs.value) {
        const report = reports.value.find(r => r.id === reportId)
        if (!report || report.status !== 'pending') continue
        const rewardValue = Number(String(report.reward || '0').replace(/\D/g, '')) || 0
        await updateDoc(doc(db, "users", report.uid), { balance: increment(rewardValue) })
        await updateDoc(doc(db, "reports", report.id), { status: 'approved', approvedAt: serverTimestamp() })
        updateLocalStatsOnApprove(report.jobName);
      }
      selectedOtherJobs.value = []
      Swal.fire('THÀNH CÔNG!', 'Đã quét sạch các đơn được chọn!', 'success')
    } catch (error) {
      Swal.fire('LỖI!', 'Có lỗi xảy ra: ' + error, 'error')
    }
  }
}

// ============================================================================
// 5. KÉO DỮ LIỆU TỪ FIREBASE
// ============================================================================
let unsubReports: any = null;
let unsubWithdrawals: any = null;
let unsubNotes: any = null;

const loadData = (newStatus: string) => {
  if (searchQuery.value.trim() !== '') return;
  isLoading.value = true;
  if (unsubReports) unsubReports();
  if (unsubWithdrawals) unsubWithdrawals();

  const site = siteFilter.value;
  let qReports;
  if (newStatus === 'all') {
    // Khi lọc theo site cụ thể: bỏ orderBy để tránh cần composite index, sort client-side
    qReports = site !== 'all'
      ? query(collection(db, "reports"), where("site", "==", site), limit(100))
      : query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100));
  } else if (newStatus === 'approved') {
    qReports = site !== 'all'
      ? query(collection(db, "reports"), where("site", "==", site), where("status", "in", ["approved", "collected"]), limit(100))
      : query(collection(db, "reports"), where("status", "in", ["approved", "collected"]), limit(100));
  } else {
    qReports = site !== 'all'
      ? query(collection(db, "reports"), where("site", "==", site), where("status", "==", newStatus), limit(100))
      : query(collection(db, "reports"), where("status", "==", newStatus), limit(100));
  }

  unsubReports = onSnapshot(qReports, (snapshot) => {
    let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : (t ? new Date(t).getTime() : Date.now() + 15000);
    data.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
    reports.value = data;
    isLoading.value = false;
  }, (error) => { console.error("LỖI BẰNG CHỨNG:", error); isLoading.value = false; });

  let qWithdrawals;
  if (newStatus === 'all') {
    qWithdrawals = site !== 'all'
      ? query(collection(db, "withdrawals"), where("site", "==", site), limit(50))
      : query(collection(db, "withdrawals"), orderBy("createdAt", "desc"), limit(50));
  } else {
    qWithdrawals = site !== 'all'
      ? query(collection(db, "withdrawals"), where("site", "==", site), where("status", "==", newStatus), limit(50))
      : query(collection(db, "withdrawals"), where("status", "==", newStatus), limit(50));
  }
  unsubWithdrawals = onSnapshot(qWithdrawals, (snapshot) => {
    let wData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime();
    wData.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
    withdrawals.value = wData;
  }, (error) => { console.error("LỖI RÚT TIỀN:", error); });

  // Chỉ tạo 1 lần duy nhất, không recreate khi statusFilter thay đổi
  if (!unsubNotes) {
    unsubNotes = onSnapshot(query(collection(db, "admin_notes"), limit(50)), (snapshot) => {
      let notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const getTime = (t: any) => t?.toDate ? t.toDate().getTime() : new Date(t || 0).getTime();
      notesData.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
      dailyNotes.value = notesData;
    });
  }
}

watch(statusFilter, (newVal) => {
  if (!isCheckingAuth.value) { searchQuery.value = ''; loadData(newVal); }
})

watch(siteFilter, () => {
  if (!isCheckingAuth.value) { searchQuery.value = ''; loadData(statusFilter.value); loadDashboardStats(); }
})

// ============================================================================
// 6. CÁC HÀM XỬ LÝ
// ============================================================================
const openRejectPopup = (id: string) => { selectedReportId.value = id; rejectReason.value = ''; showRejectPopup.value = true }
const closeRejectPopup = () => { showRejectPopup.value = false; selectedReportId.value = null; rejectReason.value = '' }

const confirmReject = async () => {
  if (!selectedReportId.value) return
  try {
    await updateDoc(doc(db, "reports", selectedReportId.value), { status: 'rejected', note: rejectReason.value || "Thông tin không chính xác" })
    closeRejectPopup()
  } catch(error) { alert("LỖI KHI HỦY: " + error) }
}

const showMessagePopup = ref(false)
const messageText = ref('')
const openMessagePopup = (id: string) => { selectedReportId.value = id; messageText.value = ''; showMessagePopup.value = true }
const closeMessagePopup = () => { showMessagePopup.value = false; selectedReportId.value = null; messageText.value = '' }

const confirmMessage = async () => {
  if (!selectedReportId.value) return
  try {
    await updateDoc(doc(db, "reports", selectedReportId.value), { note: messageText.value || "Vui lòng liên hệ Admin để được hỗ trợ" })
    closeMessagePopup()
  } catch(error) { alert("LỖI KHI GỬI LỜI NHẮN: " + error) }
}

onMounted(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isBoss = user.email === 'nguyenvanca14062001@gmail.com';
      const userDoc = await getDoc(doc(db, "users", user.uid))
      const userData = userDoc.data()
      if (!isBoss && userData?.role !== 'admin') {
        Swal.fire({ icon: 'error', title: 'TRUY CẬP BỊ CHẶN!', text: 'Nàng không có quyền vào khu vực này!', confirmButtonColor: '#ED4E95' }).then(() => { router.push('/') })
        return
      }
      isCheckingAuth.value = false;
      onSnapshot(query(collection(db, "users"), limit(1000)), (snapshot) => {
        const map: Record<string, any> = {}
        snapshot.docs.forEach(doc => { map[doc.id] = doc.data() })
        usersMap.value = map
      })
      loadData(statusFilter.value);
      loadDashboardStats();
    } else {
      router.push('/login')
    }
  })
})

const isAppJob = (jobName: string) => {
  if (!jobName) return false;
  const name = jobName.toLowerCase();
  const keywords = ['app', 'ngân hàng', 'chứng khoán', 'vpbank', 'tpbank', 'mbbank', 'msb', 'cake', 'tnex', 'kafi', 'dnse', 'kis', 'liobank'];
  return keywords.some(kw => name.includes(kw));
}

const checkReportStatus = (status: string) => {
  if (statusFilter.value === 'all') return true;
  if (statusFilter.value === 'approved') return status === 'approved' || status === 'collected';
  return status === statusFilter.value;
}

const filteredAppReports = computed(() =>
  reports.value.filter(r =>
    (siteFilter.value === 'all' || r.site === siteFilter.value) &&
    (searchQuery.value.trim() !== '' ? true : checkReportStatus(r.status)) &&
    isAppJob(r.jobName)
  )
)

const filteredOtherReports = computed(() =>
  reports.value.filter(r =>
    (siteFilter.value === 'all' || r.site === siteFilter.value) &&
    (searchQuery.value.trim() !== '' ? true : checkReportStatus(r.status)) &&
    !isAppJob(r.jobName)
  )
)

const filteredWithdrawals = computed(() =>
  withdrawals.value.filter(w =>
    (siteFilter.value === 'all' || w.site === siteFilter.value) &&
    (searchQuery.value.trim() !== '' ? true : (statusFilter.value === 'all' || w.status === statusFilter.value))
  )
)

const getXuAmount = (wd: any) => {
  let xu = wd.amountXu || wd.amount || wd.xu || 0;
  if (typeof xu === 'string') xu = Number(xu.replace(/\D/g, ''));
  return Number(xu) || 0;
}

const getVndAmount = (wd: any) => {
  let vnd = wd.realMoney || wd.money || 0;
  if (typeof vnd === 'string') vnd = Number(vnd.replace(/\D/g, ''));
  let finalVnd = Number(vnd) || 0;
  let finalXu = getXuAmount(wd);
  if (finalVnd === 0 && finalXu > 0) finalVnd = finalXu / 10;
  else if (finalVnd === finalXu && finalXu > 0) finalVnd = finalXu / 10;
  return finalVnd;
}

const fixUserWallet = async (uid: string) => {
  const currentVal = usersMap.value[uid]?.balance || 0;
  const newVal = prompt(`Khách đang có: ${currentVal} XU.\n\nNhập số tiền chuẩn để sửa ví (CHỈ NHẬP SỐ):`, "0");
  if (newVal !== null) {
    let cleanNum = Number(newVal.replace(/\D/g, '')) || 0;
    try {
      await updateDoc(doc(db, "users", uid), { balance: cleanNum });
      alert(`🎉 Đã sửa ví khách thành công: ${cleanNum} XU!`);
    } catch (e) { alert("Lỗi: " + e); }
  }
}

const approveReport = async (report: any) => {
  const rewardValue = Number(String(report.reward || '0').replace(/\D/g, '')) || 0;
  try {
    const userRef = doc(db, "users", report.uid)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      const userData = userSnap.data()
      let currentBalance = Number(String(userData.balance).replace(/\D/g, '')) || 0;
      const newTotalBalance = currentBalance + rewardValue;
      if (!confirm(`XÁC NHẬN DUYỆT ĐƠN NÀY?\n\n+ Tiền cộng: ${rewardValue.toLocaleString()} XU\n+ Ví cũ đang có: ${currentBalance.toLocaleString()} XU\n👉 TỔNG TIỀN MỚI: ${newTotalBalance.toLocaleString()} XU`)) return;
      await updateDoc(userRef, { balance: newTotalBalance })
      await updateDoc(doc(db, "reports", report.id), { status: 'approved', approvedAt: serverTimestamp() })
      alert("ĐÃ DUYỆT VÀ CỘNG XU THÀNH CÔNG!")
      updateLocalStatsOnApprove(report.jobName);
    }
  } catch (error) { alert("LỖI KHI DUYỆT: " + error) }
}

const deleteReport = async (id: string) => {
  if (confirm("BẠN CÓ CHẮC CHẮN MUỐN XÓA VĨNH VIỄN ĐƠN NÀY?")) {
    try { await deleteDoc(doc(db, "reports", id)) } catch(error) { alert("LỖI XÓA ĐƠN: " + error) }
  }
}

const approveWithdrawal = async (item: any) => {
  const displayAmount = getVndAmount(item);
  const { isConfirmed } = await Swal.fire({
    title: 'XÁC NHẬN ĐÃ CHUYỂN KHOẢN?',
    text: `Đã chuyển khoản ${displayAmount.toLocaleString('vi-VN')} VNĐ cho khách này?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ĐÃ CHUYỂN',
    confirmButtonColor: '#10b981',
    cancelButtonText: 'HỦY'
  });
  if (isConfirmed) {
    try {
      await updateDoc(doc(db, "withdrawals", item.id), { status: 'approved' });
      await updateDoc(doc(db, "users", item.uid), { hasPendingWithdraw: false });
      setTimeout(() => {
        Swal.fire({ title: 'HOÀN TẤT CHUYỂN KHOẢN! 🎉', text: 'Chúc mừng bạn đã duyệt rút tiền thành công. Hãy nhắc khách kiểm tra nhé!', icon: 'success', confirmButtonText: 'TUYỆT VỜI', confirmButtonColor: '#10b981' });
      }, 200);
    } catch (error: any) { Swal.fire('Lỗi rùi!', error.message, 'error'); }
  }
}

const rejectWithdrawal = async (item: any) => {
  const { value: note, isConfirmed } = await Swal.fire({
    title: 'TỪ CHỐI RÚT TIỀN',
    text: 'Nhập lý do từ chối. Hệ thống sẽ TỰ ĐỘNG HOÀN XU lại vào ví.',
    input: 'text',
    inputPlaceholder: 'VD: Sai thông tin ngân hàng...',
    showCancelButton: true,
    confirmButtonColor: '#ef4444'
  })
  if (isConfirmed) {
    try {
      await updateDoc(doc(db, "withdrawals", item.id), { status: 'rejected', adminNote: note || 'Quản trị viên từ chối' })
      const refundAmount = getXuAmount(item);
      await updateDoc(doc(db, "users", item.uid), { balance: increment(refundAmount), hasPendingWithdraw: false })
      Swal.fire('Đã hủy & Hoàn xu!', `User đã nhận lại ${refundAmount.toLocaleString('vi-VN')} XU vào ví.`, 'success')
    } catch (error: any) { Swal.fire('Lỗi!', error.message, 'error') }
  }
}

const deleteWithdrawal = async (id: string) => {
  if (confirm("XÓA LỊCH SỬ RÚT TIỀN NÀY? LƯU Ý LÀ SẼ KHÔNG HOÀN TIỀN!")) {
    try { await deleteDoc(doc(db, "withdrawals", id)) } catch(error) { alert("LỖI XÓA ĐƠN: " + error) }
  }
}

const formatDate = (timestamp: any) => {
  if (!timestamp) return ''
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return `${d.getHours()}:${d.getMinutes()} - ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

const handleAdminLogout = async () => {
  if(confirm('XÁC NHẬN THOÁT ADMIN?')) { await signOut(auth); router.push('/login') }
}
</script>

<template>
  <div class="min-h-screen bg-[#090e17] flex flex-col items-center justify-center" v-if="isCheckingAuth">
    <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    <p class="mt-4 text-blue-500 font-black italic uppercase tracking-widest text-sm">Đang xác minh Admin...</p>
  </div>

  <div class="min-h-screen bg-[#090e17] p-4 md:p-10 font-black italic uppercase text-left selection:bg-blue-500/30 relative" v-else>

    <Transition name="fade">
      <div class="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-zoom-out" v-if="selectedImage" @click="closeImage">
        <button class="absolute top-6 right-6 md:top-10 md:right-10 w-12 h-12 bg-slate-800 border border-slate-700 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors z-[6010] shadow-2xl" @click.stop="closeImage">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
        <img class="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-[6005] cursor-default" :src="selectedImage" @click.stop />
      </div>
    </Transition>

    <Transition name="fade">
      <div class="fixed inset-0 z-[5000] flex items-center justify-center px-4" v-if="showRejectPopup">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeRejectPopup"></div>
        <div class="relative bg-[#111726] border border-red-500/30 w-full max-w-md p-6 rounded-2xl shadow-2xl text-center">
          <h3 class="text-xl text-red-500 mb-4 tracking-tight">TỪ CHỐI BẰNG CHỨNG</h3>
          <p class="text-slate-400 text-xs normal-case not-italic font-bold mb-4">Vui lòng nhập lý do từ chối để khách hàng biết.</p>
          <textarea class="w-full bg-[#0d121f] text-white border border-slate-700 rounded-xl p-3 mb-6 focus:outline-none focus:border-red-500 font-sans normal-case not-italic text-sm" v-model="rejectReason" rows="3" placeholder="Ví dụ: Ảnh mờ, Sai thông tin..."></textarea>
          <div class="flex gap-3 justify-end">
            <button class="px-5 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs transition-colors" @click="closeRejectPopup">HỦY BỎ</button>
            <button class="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs shadow-lg transition-colors" @click="confirmReject">XÁC NHẬN TỪ CHỐI</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div class="fixed inset-0 z-[5000] flex items-center justify-center px-4" v-if="showMessagePopup">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeMessagePopup"></div>
        <div class="relative bg-[#111726] border border-blue-500/30 w-full max-w-md p-6 rounded-2xl shadow-2xl text-center">
          <h3 class="text-xl text-blue-500 mb-4 tracking-tight">GỬI LỜI NHẮN (ĐƠN VẪN CHỜ)</h3>
          <p class="text-slate-400 text-xs normal-case not-italic font-bold mb-4">Lời nhắn sẽ hiển thị cho khách nhưng đơn không bị Hủy.</p>
          <textarea class="w-full bg-[#0d121f] text-white border border-slate-700 rounded-xl p-3 mb-6 focus:outline-none focus:border-blue-500 font-sans normal-case not-italic text-sm" v-model="messageText" rows="3" placeholder="Ví dụ: Bạn nhắn tin cho Admin để kiểm tra lại nhé..."></textarea>
          <div class="flex gap-3 justify-end">
            <button class="px-5 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-xl text-xs transition-colors" @click="closeMessagePopup">HỦY BỎ</button>
            <button class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs shadow-lg transition-colors" @click="confirmMessage">GỬI LỜI NHẮN</button>
          </div>
        </div>
      </div>
    </Transition>

    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <h1 class="text-3xl md:text-5xl text-white tracking-tighter leading-none">HỆ THỐNG <span class="text-blue-500">ADMIN</span></h1>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1 bg-[#111726] p-1.5 rounded-xl border border-slate-800 focus-within:border-blue-500 transition-colors">
          <input class="bg-[#0d121f] text-white text-[10px] py-2 px-3 rounded-lg border border-slate-700 outline-none w-[170px] md:w-[200px] placeholder:text-slate-600 font-sans not-italic normal-case" v-model="searchQuery" @keyup.enter="handleSearch" type="text" placeholder="🔎 Tìm Username hoặc SĐT..." />
          <button class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-[10px] font-black transition-colors" @click="handleSearch">TÌM</button>
          <button class="bg-slate-700 hover:bg-slate-600 text-white px-2 py-2 rounded-lg text-[10px] font-black transition-colors" v-if="searchQuery" @click="searchQuery = ''; handleSearch()">✕</button>
        </div>
        <div class="flex items-center gap-2 bg-[#111726] p-1.5 rounded-xl border border-slate-800">
          <span class="text-[10px] text-emerald-500 tracking-[2px] ml-2 hidden md:inline">TRẠNG THÁI:</span>
          <select class="bg-[#0d121f] text-white text-[10px] py-2 px-3 rounded-lg border border-slate-700 outline-none cursor-pointer" v-model="statusFilter">
            <option value="pending">⏳ ĐANG CHỜ DUYỆT</option>
            <option value="all">📚 TẤT CẢ LỊCH SỬ</option>
            <option value="approved">✅ ĐÃ DUYỆT</option>
            <option value="rejected">❌ BỊ HỦY</option>
          </select>
        </div>
        <div class="flex items-center gap-2 bg-[#111726] p-1.5 rounded-xl border border-slate-800">
          <span class="text-[10px] text-slate-500 tracking-[2px] ml-2 hidden md:inline">LỌC SITE:</span>
          <select class="bg-[#0d121f] text-white text-[10px] py-2 px-3 rounded-lg border border-slate-700 outline-none cursor-pointer" v-model="siteFilter">
            <option value="all">TẤT CẢ VŨ TRỤ</option>
            <option value="mmo">MMO PRO (Xanh)</option>
            <option value="freelance">MÂY FREELANCE (Hồng)</option>
          </select>
        </div>
        <button class="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-[10px] hover:bg-red-600 transition-colors" @click="handleAdminLogout">THOÁT</button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
      <div class="md:col-span-4 flex flex-col gap-4">
        <div class="flex-1 bg-gradient-to-br from-[#111726] to-[#0d121f] border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 text-7xl opacity-5 group-hover:scale-110 transition-transform">📊</div>
          <div class="flex justify-between items-start mb-2">
            <p class="text-slate-500 text-[10px] font-black tracking-widest uppercase">TỔNG DUYỆT HÔM NAY</p>
            <div class="flex gap-2">
              <button class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95 flex items-center gap-1.5" @click="saveDailyNote">📝 CHỐT SỔ</button>
              <button class="text-slate-400 hover:text-blue-500 active:scale-90 transition-transform bg-[#090e17] p-2 md:p-2.5 rounded-xl border border-slate-700/50 shadow-inner" @click="loadDashboardStats">
                <svg :class="['w-4 h-4 md:w-5 md:h-5', isStatsLoading ? 'animate-spin text-blue-500' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
            </div>
          </div>
          <div class="text-3xl md:text-4xl text-emerald-400 font-black drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
            {{ isStatsLoading ? '...' : statsTodayTotal }} <span class="text-sm text-slate-600 font-bold uppercase tracking-widest">Đơn</span>
          </div>
        </div>
        <div class="flex-1 bg-gradient-to-br from-[#111726] to-[#0d121f] border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 text-7xl opacity-5 group-hover:scale-110 transition-transform">📱</div>
          <p class="text-slate-500 text-[10px] font-black tracking-widest mb-2 uppercase">APP NGÂN HÀNG HÔM NAY</p>
          <div class="text-3xl md:text-4xl text-blue-400 font-black drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
            {{ isStatsLoading ? '...' : statsTodayAppTotal }} <span class="text-sm text-slate-600 font-bold uppercase tracking-widest">Đơn</span>
          </div>
        </div>
      </div>
      <div class="md:col-span-8 bg-gradient-to-br from-[#111726] to-[#0d121f] border border-slate-800/80 rounded-2xl p-5 shadow-lg">
        <p class="text-slate-500 text-[10px] font-black tracking-widest mb-4 uppercase flex items-center gap-2">
          <span>CHI TIẾT ĐỐI SOÁT CÁC CHIẾN DỊCH APP</span>
          <span class="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[8px] border border-blue-500/30">LIVE</span>
        </p>
        <div class="flex justify-center items-center py-6" v-if="isStatsLoading">
          <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3" v-else>
          <div class="bg-[#090e17] border border-slate-700/50 rounded-xl p-4 flex flex-col gap-2 shadow-inner" v-for="(data, name) in statsAppBreakdown" :key="name">
            <div class="text-[10px] md:text-xs text-blue-400 font-black tracking-widest uppercase border-b border-slate-800 pb-2">{{ name }}</div>
            <div class="flex justify-between items-center mt-1">
              <span class="text-slate-500 text-[10px] uppercase font-bold">Hôm nay:</span>
              <span :class="['text-base font-black', data.today > 0 ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'text-slate-500']">{{ data.today }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-8">
      <p class="text-blue-500 text-[10px] font-black tracking-[3px] mb-3 ml-2 flex items-center gap-2">
        <span>📒 SỔ TAY ĐỐI SOÁT LỊCH SỬ</span>
        <span class="text-slate-500 text-[8px] normal-case not-italic font-bold">(Bấm "Chốt Sổ" ở bảng thống kê bên trên để lưu báo cáo ngày)</span>
      </p>
      <div class="bg-[#111726] border border-slate-800 rounded-3xl p-4 overflow-x-auto shadow-2xl">
        <table class="w-full text-left">
          <tbody class="divide-y divide-slate-800/50 italic">
            <tr class="group hover:bg-white/[0.02] transition-colors" v-for="note in dailyNotes" :key="note.id">
              <td class="py-3 px-4 whitespace-nowrap text-emerald-400 text-xs font-black">{{ note.dateLabel }}</td>
              <td class="py-3 px-4 text-slate-300 text-[11px] normal-case font-bold tracking-tight w-full">{{ note.content }}</td>
              <td class="py-3 px-4 text-right whitespace-nowrap text-slate-500 text-[10px] font-black uppercase">Tổng: <span class="text-white">{{ note.totalToday }}</span> đơn</td>
              <td class="py-3 px-4 text-right">
                <button class="text-red-900 group-hover:text-red-500 transition-colors text-lg" @click="deleteNote(note.id)">✕</button>
              </td>
            </tr>
            <tr v-if="dailyNotes.length === 0">
              <td class="py-10 text-center text-slate-700 text-[10px] tracking-[2px]" colspan="4">CHƯA CÓ LỊCH SỬ ĐỐI SOÁT NÀO TRONG SỔ TAY.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex gap-4 mb-6 flex-wrap md:flex-nowrap">
      <button :class="['flex-1 py-4 rounded-xl tracking-widest transition-all text-xs md:text-sm', activeTab === 'app_jobs' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'bg-[#111726] text-slate-500 hover:bg-[#1a2335]']" @click="activeTab = 'app_jobs'">
        APP NGÂN HÀNG/CHỨNG KHOÁN ({{ filteredAppReports.length }})
      </button>
      <button :class="['flex-1 py-4 rounded-xl tracking-widest transition-all text-xs md:text-sm', activeTab === 'other_jobs' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-[#111726] text-slate-500 hover:bg-[#1a2335]']" @click="activeTab = 'other_jobs'">
        CÁC JOB KHÁC ({{ filteredOtherReports.length }})
      </button>
      <button :class="['flex-1 py-4 rounded-xl tracking-widest transition-all text-xs md:text-sm', activeTab === 'withdrawals' ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-[#111726] text-slate-500 hover:bg-[#1a2335]']" @click="activeTab = 'withdrawals'">
        QUẢN LÝ RÚT TIỀN ({{ filteredWithdrawals.length }})
      </button>
    </div>

    <div class="bg-[#111726] border border-slate-800 rounded-[30px] overflow-hidden shadow-2xl">
      <div class="p-20 text-center text-blue-500 animate-pulse tracking-widest" v-if="isLoading">ĐANG TẢI DỮ LIỆU BẢNG...</div>
      <div class="overflow-x-auto" v-else>
        <Transition name="fade">
          <div class="bg-blue-900/40 border-b border-blue-500/30 p-4 flex justify-between items-center px-6" v-if="activeTab === 'other_jobs' && selectedOtherJobs.length > 0">
            <span class="text-blue-400 font-bold text-sm tracking-widest">ĐÃ CHỌN: <span class="text-white text-lg">{{ selectedOtherJobs.length }}</span> ĐƠN</span>
            <button class="bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-xl text-[10px] md:text-sm tracking-widest font-black transition-all active:scale-95 shadow-[0_0_20px_rgba(59,130,246,0.5)]" @click="bulkApproveOtherJobs">DUYỆT TẤT CẢ ĐƠN ĐÃ CHỌN 🚀</button>
          </div>
        </Transition>

        <table class="w-full text-left border-collapse" v-if="activeTab === 'app_jobs' || activeTab === 'other_jobs'">
          <thead>
            <tr class="bg-[#0d121f] text-blue-500 text-[10px] tracking-[2px] border-b border-slate-800">
              <th class="p-6 text-center w-12" v-if="activeTab === 'other_jobs'">
                <input class="w-5 h-5 cursor-pointer accent-blue-500 bg-[#111726] border-slate-700 rounded" type="checkbox" :checked="isAllOtherJobsSelected" @change="toggleAllOtherJobs" />
              </th>
              <th class="p-6 min-w-[250px]">NGƯỜI NỘP / TÀI KHOẢN</th>
              <th class="p-6 min-w-[150px]">CÔNG VIỆC</th>
              <th class="p-6 text-center min-w-[150px]">BẰNG CHỨNG</th>
              <th class="p-6 text-center min-w-[120px]">TRẠNG THÁI</th>
              <th class="p-6 text-right min-w-[200px]">HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/50">
            <tr v-for="rp in (activeTab === 'app_jobs' ? filteredAppReports : filteredOtherReports)" :key="rp.id" :class="['hover:bg-white/[0.02] transition-colors group', selectedOtherJobs.includes(rp.id) ? 'bg-blue-900/10' : '']">
              <td class="p-6 text-center" v-if="activeTab === 'other_jobs'">
                <input class="w-5 h-5 cursor-pointer accent-blue-500 bg-[#111726] border-slate-700 rounded" v-if="rp.status === 'pending'" type="checkbox" :value="rp.id" v-model="selectedOtherJobs" />
              </td>
              <td class="p-6">
                <div class="mb-2 pb-2 border-b border-slate-700/50 flex justify-between items-start">
                  <div>
                    <span class="text-[9px] text-emerald-400 tracking-widest block mb-0.5">TÀI KHOẢN GỐC:</span>
                    <div class="text-white text-sm md:text-base font-black truncate max-w-[200px]">{{ usersMap[rp.uid]?.username || usersMap[rp.uid]?.fullName || 'CHƯA CẬP NHẬT' }}</div>
                    <div class="text-slate-400 text-[10px] mt-0.5 font-sans not-italic tracking-normal">Ví hiện tại: <span class="text-yellow-400 font-black">{{ usersMap[rp.uid]?.balance }} XU</span></div>
                    <div class="text-slate-400 text-[10px] mt-0.5 font-sans not-italic tracking-normal">
                      Ngày sinh:
                      <span class="text-emerald-400 font-bold uppercase" v-if="usersMap[rp.uid]?.dateOfBirth || usersMap[rp.uid]?.dob || usersMap[rp.uid]?.ngaysinh">{{ usersMap[rp.uid]?.dateOfBirth || usersMap[rp.uid]?.dob || usersMap[rp.uid]?.ngaysinh }}</span>
                      <span class="text-slate-600 italic bg-slate-800/50 px-1 py-0.5 rounded" v-else>Khách cũ</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-1">
                    <span class="bg-pink-500/20 text-pink-400 border border-pink-500/30 text-[8px] px-2 py-0.5 rounded uppercase" v-if="rp.site === 'freelance'">FREELANCE</span>
                    <span class="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[8px] px-2 py-0.5 rounded uppercase" v-else>MMO</span>
                    <button class="bg-yellow-600/20 text-yellow-500 hover:bg-yellow-500 hover:text-white border border-yellow-600/50 px-2 py-1 rounded-lg text-[8px] transition-all" @click="fixUserWallet(rp.uid)">SỬA VÍ</button>
                  </div>
                </div>
                <div>
                  <span class="text-[9px] text-blue-400 tracking-widest block mb-0.5">NỘI DUNG ĐƠN NỘP ({{ formatDate(rp.createdAt) }}):</span>
                  <div class="text-slate-300 text-xs font-black truncate max-w-[200px]">{{ rp.fullName || 'N/A' }}</div>
                  <div class="text-slate-500 text-[10px] mt-0.5 font-sans not-italic tracking-normal">SĐT ĐƠN: {{ rp.phoneRef || 'Không có' }}</div>
                  <div class="text-slate-400 text-[10px] mt-0.5 font-sans not-italic tracking-normal">
                    Năm sinh đơn nộp:
                    <span class="text-yellow-400 font-bold" v-if="rp.birthYear">{{ rp.birthYear }}</span>
                    <span class="text-slate-600 italic" v-else>Đơn cũ chưa nhập</span>
                  </div>
                </div>
              </td>
              <td class="p-6">
                <div class="text-slate-300 text-[11px] leading-tight mb-1">{{ rp.jobName }}</div>
                <div class="text-emerald-400 text-sm font-black">+{{ String(rp.reward).replace(/\D/g, '') }} XU</div>
              </td>
              <td class="p-6">
                <div class="flex justify-center gap-2">
                  <a class="bg-blue-600 text-[8px] text-white p-2 rounded" v-if="rp.taskLink" :href="rp.taskLink" target="_blank">MỞ LINK BÀI</a>
                  <div class="relative cursor-pointer" v-for="(img, idx) in rp.images" :key="idx" @click="openImage(img)">
                    <div class="block w-12 h-12 rounded-lg border border-slate-700 overflow-hidden hover:scale-110 hover:border-blue-500 transition-all shadow-lg">
                      <img class="w-full h-full object-cover" :src="img" />
                    </div>
                  </div>
                  <div class="text-slate-700 text-[9px]" v-if="!rp.images?.length && !rp.taskLink">KHÔNG CÓ ẢNH</div>
                </div>
              </td>
              <td class="p-6 text-center text-[10px]">
                <span class="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full border border-yellow-500/20" v-if="rp.status === 'pending'">ĐANG CHỜ</span>
                <span class="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20" v-else-if="rp.status === 'approved' || rp.status === 'collected'">ĐÃ DUYỆT</span>
                <span class="bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20" v-else>BỊ HỦY</span>
                <div :class="['text-[8px] mt-2 normal-case leading-tight', rp.status === 'rejected' ? 'text-red-400 italic' : 'text-blue-400 font-bold']" v-if="rp.note">LỜI NHẮN: {{ rp.note }}</div>
              </td>
              <td class="p-6 text-right">
                <div class="flex flex-col md:flex-row justify-end gap-2">
                  <template v-if="rp.status === 'pending'">
                    <button class="bg-emerald-500 hover:bg-emerald-400 text-white text-[9px] px-4 py-2 rounded-lg transition-all active:scale-95" @click="approveReport(rp)">DUYỆT</button>
                    <button class="bg-blue-600 hover:bg-blue-500 text-white text-[9px] px-4 py-2 rounded-lg transition-all active:scale-95" @click="openMessagePopup(rp.id)">NHẮN</button>
                    <button class="bg-red-600 hover:bg-red-500 text-white text-[9px] px-4 py-2 rounded-lg transition-all active:scale-95" @click="openRejectPopup(rp.id)">HỦY</button>
                  </template>
                  <button class="bg-slate-800 text-slate-400 hover:text-white text-[9px] px-4 py-2 rounded-lg transition-all active:scale-95" @click="deleteReport(rp.id)">XÓA</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table class="w-full text-left border-collapse" v-else-if="activeTab === 'withdrawals'">
          <thead>
            <tr class="bg-[#0d121f] text-emerald-500 text-[10px] tracking-[2px] border-b border-slate-800">
              <th class="p-6 min-w-[200px]">NGƯỜI RÚT</th>
              <th class="p-6 min-w-[250px]">THÔNG TIN NGÂN HÀNG</th>
              <th class="p-6 text-center min-w-[150px]">SỐ TIỀN</th>
              <th class="p-6 text-center min-w-[120px]">TRẠNG THÁI</th>
              <th class="p-6 text-right min-w-[200px]">HÀNH ĐỘNG</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/50">
            <tr class="hover:bg-white/[0.02] transition-colors group" v-for="wd in filteredWithdrawals" :key="wd.id">
              <td class="p-6">
                <div class="flex items-center gap-2 mb-1">
                  <span class="bg-pink-500/20 text-pink-400 border border-pink-500/30 text-[8px] px-2 py-0.5 rounded uppercase" v-if="wd.site === 'freelance'">FREELANCE</span>
                  <span class="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[8px] px-2 py-0.5 rounded uppercase" v-else>MMO</span>
                </div>
                <div class="text-white text-sm md:text-base font-black">{{ usersMap[wd.uid]?.username || 'CHƯA CẬP NHẬT' }}</div>
                <div class="text-slate-400 text-[10px] mt-0.5 font-sans not-italic tracking-normal">
                  Ngày sinh:
                  <span class="text-emerald-400 font-bold uppercase" v-if="usersMap[wd.uid]?.dateOfBirth || usersMap[wd.uid]?.dob || usersMap[wd.uid]?.ngaysinh">{{ usersMap[wd.uid]?.dateOfBirth || usersMap[wd.uid]?.dob || usersMap[wd.uid]?.ngaysinh }}</span>
                  <span class="text-slate-600 italic bg-slate-800/50 px-1 py-0.5 rounded" v-else>Khách cũ</span>
                </div>
                <div class="text-slate-500 text-[10px] mt-0.5 font-sans not-italic">{{ formatDate(wd.createdAt) }}</div>
              </td>
              <td class="p-6">
                <div class="text-slate-300 text-[11px] font-sans not-italic leading-relaxed max-w-[250px] bg-[#0d121f] p-3 rounded-xl border border-slate-700">{{ wd.bankInfo }}</div>
              </td>
              <td class="p-6 text-center">
                <div class="text-emerald-400 text-lg font-black">{{ getVndAmount(wd).toLocaleString('vi-VN') }} VNĐ</div>
                <div class="text-yellow-500 text-[9px] font-sans tracking-widest mt-1">(Đã trừ {{ getXuAmount(wd).toLocaleString('vi-VN') }} XU)</div>
              </td>
              <td class="p-6 text-center text-[10px]">
                <span class="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full border border-yellow-500/20" v-if="wd.status === 'pending'">ĐANG CHỜ</span>
                <span class="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20" v-else-if="wd.status === 'approved'">ĐÃ CHUYỂN</span>
                <span class="bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20" v-else>HỦY & HOÀN</span>
              </td>
              <td class="p-6 text-right">
                <div class="flex flex-col md:flex-row justify-end gap-2">
                  <template v-if="wd.status === 'pending'">
                    <button class="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] px-4 py-2 rounded-lg transition-all active:scale-95" @click="approveWithdrawal(wd)">ĐÃ CHUYỂN KHOẢN</button>
                    <button class="bg-red-600 hover:bg-red-500 text-white text-[9px] px-4 py-2 rounded-lg transition-all active:scale-95" @click="rejectWithdrawal(wd)">TỪ CHỐI & HOÀN XU</button>
                  </template>
                  <button class="bg-slate-800 text-slate-400 hover:text-white text-[9px] px-4 py-2 rounded-lg transition-all active:scale-95" @click="deleteWithdrawal(wd.id)">XÓA</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="p-20 text-center text-slate-700 tracking-widest text-xs"
          v-if="!isLoading && ((activeTab === 'app_jobs' && filteredAppReports.length === 0) || (activeTab === 'other_jobs' && filteredOtherReports.length === 0) || (activeTab === 'withdrawals' && filteredWithdrawals.length === 0))">
          HIỆN CHƯA CÓ YÊU CẦU NÀO TRONG MỤC NÀY.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
