// Migration MỘT LẦN: backfill collection usernames/{normalizedUsername} từ dữ liệu users hiện có.
//
// Vì sao cần script này: sau khi Firestore Rules mới khoá /users chỉ cho owner/admin đọc,
// RegisterView không còn query được collection("users") để kiểm tra trùng username. Thay vào
// đó dùng index usernames/{normalizedUsername} -> { uid }. Script này tạo index đó cho các
// user ĐÃ ĐĂNG KÝ TRƯỚC KHI có index này.
//
// Script dùng firebase-admin (service account) thay vì SDK client — vì:
//   - phải đọc TOÀN BỘ collection users, trong khi rules mới không cho phép client (kể cả
//     admin) list toàn bộ collection này (AdminView hiện chỉ getDoc từng uid riêng lẻ);
//   - admin SDK bỏ qua Firestore Rules hoàn toàn nên không phụ thuộc rules đang cấu hình ra sao.
//
// KHÔNG sửa/xoá/tạo lại users/{uid}. KHÔNG đụng Firebase Authentication.
// KHÔNG đổi balance, role hay bất kỳ field nào khác của user cũ.
// Nếu usernames/{normalized} đã tồn tại thì KHÔNG overwrite mù quáng.
// Nếu 2 user cũ trùng username sau normalize thì KHÔNG tạo index cho key đó — log riêng để
// admin xử lý thủ công (đổi username 1 trong 2 tài khoản trước).
//
// Cách chạy:
//   1. Firebase Console -> Project Settings -> Service accounts -> Generate new private key
//      -> lưu file JSON tải về vào thư mục gốc project, KHÔNG commit file này lên git
//      (đã thêm serviceAccountKey*.json vào .gitignore).
//   2. npm run migrate:usernames -- --service-account=./serviceAccountKey.json
//      (thêm --dry-run để xem trước, không ghi gì vào Firestore)

import { readFileSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// PHẢI giống hệt logic trong src/utils/username.ts normalizeUsername() — dùng chung 1 quy tắc
// cho đăng ký mới, kiểm tra trùng, và migration, nếu không user cũ/mới sẽ ra 2 key khác nhau.
function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase()
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const serviceAccountArg = args.find((a) => a.startsWith('--service-account='))
const serviceAccountPath = serviceAccountArg ? serviceAccountArg.split('=')[1] : './serviceAccountKey.json'

let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
} catch (err) {
  console.error(`Không đọc được service account key tại "${serviceAccountPath}".`)
  console.error('Tải file này từ Firebase Console -> Project Settings -> Service accounts -> Generate new private key.')
  console.error('Rồi chạy lại: npm run migrate:usernames -- --service-account=./duong-dan-file.json')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function main() {
  console.log(`\n=== MIGRATION usernames/{normalizedUsername} ${dryRun ? '(DRY RUN — chỉ xem trước, KHÔNG ghi Firestore)' : ''} ===\n`)

  const usersSnap = await db.collection('users').get()
  const scanned = usersSnap.size

  let missingUsername = 0
  // normalized -> [{ uid, rawUsername }] — gom trước để phát hiện conflict TRONG CHÍNH lượt quét này
  const byNormalized = new Map()

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data()
    const raw = data.username
    const normalized = normalizeUsername(raw)
    if (!normalized) {
      missingUsername++
      continue
    }
    if (!byNormalized.has(normalized)) byNormalized.set(normalized, [])
    byNormalized.get(normalized).push({ uid: docSnap.id, rawUsername: raw })
  }

  let created = 0
  let alreadyMigrated = 0
  const conflicts = []

  for (const [normalized, entries] of byNormalized) {
    if (entries.length > 1) {
      conflicts.push({ normalized, entries })
      continue
    }

    const { uid } = entries[0]
    const usernameRef = db.collection('usernames').doc(normalized)
    const existing = await usernameRef.get()

    if (existing.exists) {
      const existingUid = existing.data()?.uid
      if (existingUid === uid) {
        // Đã migrate từ lần chạy trước — idempotent, bỏ qua, không ghi lại.
        alreadyMigrated++
      } else {
        // Index đã bị user/uid khác chiếm trước đó — không overwrite mù quáng, log conflict.
        conflicts.push({
          normalized,
          entries: [...entries, { uid: existingUid, rawUsername: '(usernames/{id} hiện có đang trỏ tới uid này)' }]
        })
      }
      continue
    }

    if (!dryRun) {
      await usernameRef.set({ uid })
    }
    created++
  }

  console.log(`Tổng user quét: ${scanned}`)
  console.log(`Username index tạo mới: ${created}${dryRun ? ' (dry-run, chưa ghi thật)' : ''}`)
  console.log(`Đã có sẵn từ lần chạy trước (bỏ qua, không overwrite): ${alreadyMigrated}`)
  console.log(`User thiếu username (bỏ qua): ${missingUsername}`)
  console.log(`Conflict — trùng username sau normalize: ${conflicts.length} nhóm`)

  if (conflicts.length > 0) {
    console.log('\n--- CHI TIẾT CONFLICT (cần admin xử lý thủ công, script KHÔNG tự chọn user nào) ---')
    for (const c of conflicts) {
      console.log(`  usernames/${c.normalized}:`)
      for (const e of c.entries) console.log(`    - uid=${e.uid}  username_gốc="${e.rawUsername}"`)
    }
  }

  console.log('\n=== XONG — không có users/{uid} nào bị sửa/xoá, không đụng Firebase Auth ===\n')
}

main().catch((err) => {
  console.error('Migration lỗi:', err)
  process.exit(1)
})
