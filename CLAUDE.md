# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server (Vite HMR)
npm run build        # Type-check + production build → dist/
npm run preview      # Preview the production build locally
npm run type-check   # vue-tsc only, no emit
npm run deploy       # Build then push dist/ to GitHub Pages via gh-pages
```

No test suite is configured.

## Architecture

**MMO PRO** is a Vietnamese online task-reward platform ("Make Money Online"). Users complete marketing tasks (view TikTok/YouTube, register bank apps, etc.), submit screenshot proof, and an admin approves/rejects submissions. Approved tasks credit XU (points) to the user's balance, which can be withdrawn.

### Stack
- Vue 3 (Composition API `<script setup>`) + TypeScript + Vite
- Firebase: Firestore (database) + Firebase Auth (email/password)
- TailwindCSS v4, Vant UI, SweetAlert2
- Deployed to GitHub Pages as a user page — uses `createWebHashHistory` (`#`-based routing) to avoid 404 on F5

### Firebase collections
| Collection | Purpose |
|---|---|
| `users` | Profile: `username`, `balance`, `receivedWelcomeGift`, `role`, `site`, `dateOfBirth`/`dob` |
| `reports` | Task submissions: `uid`, `jobId`, `jobName`, `reward`, `status` (pending/approved/rejected/collected), `note`, `createdAt`, `site`, `fullName`, `phoneRef`, `birthYear`, `images[]` |
| `withdrawals` | Withdrawal requests: `uid`, `amountXu`, `realMoney`, `bankInfo`, `status`, `site`, `createdAt` |
| `admin_notes` | Daily admin ledger entries: `dateLabel`, `content`, `totalToday`, `createdAt` |

Balance mutations use Firestore `increment()` to avoid race conditions — **except** `approveReport()` in AdminView which currently uses a read-then-write pattern (known race condition risk; safe to fix with `increment()`).

### Multi-site architecture

One Firestore database is shared across multiple websites. Every `reports`, `withdrawals`, and `users` document has a `site` field to identify which site it belongs to:
- `site: "mmo"` → trang MMO PRO (dangkyxinviec.com)
- `site: "freelance"` → trang Freelance thứ 2
- `site: "rapjob"` → trang Rạp Job (rapjob.io)
- `site: "shopping"` → trang Shopping thứ 4

**Rules:**
- On register: must write correct `site` value to Firestore
- On login: must verify `user.site` matches the current site; reject if mismatched — call `signOut(auth)` then `localStorage.clear()` before throwing error
- Users of one site must not be able to log into another site
- The `site` field on a user document must never be modified after account creation — treat it as immutable

### App.vue — the application shell

`App.vue` owns the entire logged-in experience and is where the most critical business logic lives:

- **Auth lifecycle**: `onAuthStateChanged` → `initFirebaseSync(user)` sets up three real-time `onSnapshot` listeners (user doc, reports, withdrawals). Listeners are torn down and recreated on route change via a `watch`.
- **Global popups**: welcome gift (10,000 XU on first login), admin rejection notices, admin messages, and reward collection are all modals managed in `App.vue` state, triggered by computed properties over `myReports`.
- **Fake social-proof toasts**: `startToasting()` fires random "someone just completed a job / withdrew money" notifications on a 3–5 second loop — this is intentional UX, not a real event feed.
- **Layout**: Sidebar (desktop sticky, mobile overlay) + sticky header with balance display + bottom nav (mobile only). The sidebar is rendered as a `Sidebar` component but navigation is handled back in `App.vue` via `@routerPush="handleNav"`.
- **Admin route**: detected via `route.path.includes('admin')` — skips all Firestore sync and renders `<router-view />` directly.

### Job system

`src/data/jobs.ts` is a static `Record<string, any>` keyed by job ID (e.g. `'view-tiktok'`, `'msb-bank'`). Each entry has `title`, `reward`, `steps[]` (with optional `img`, `downloadLink`, `buttonText`, `templates`, `note`), and optional `warning` for age-restricted jobs.

`JobDetailView.vue` reads `route.params.id` and looks up `jobsData[id]`. Age verification (18/20) for bank and stock-trading jobs is enforced client-side via SweetAlert2 on mount.

The special job ID `'APP NGÂN HÀNG'` is intercepted in `App.vue`'s `handleReceiveJob` to open a bank-selection modal instead of navigating.

**Job tiers (used in JobSection.vue):**
- Basic (10k–30k XU): `view-tiktok`, `view-youtube`, `post-threads`, `seeding-vinfast`, `google-map`, `join-zalo`
- VIP (85k–100k XU): `app-chung-khoan`, `app-chung-khoan-2`, `app-chung-khoan-3`, `msb-bank`, `vpbank`, `tpbank`

**One-time job restriction** (enforced in `SubmitReportView`): Basic jobs can only be submitted once per account. Checks both `jobId` field AND `jobName` field to catch old reports that may not have `jobId`. VIP jobs have no submission limit (family members can register).

### Report/withdraw flow

1. User submits proof via `SubmitReportView` → writes to `reports` with `status: 'pending'`
2. Admin reviews in `AdminView` → `approveReport()` or bulk approve → `status: 'approved'`
3. `App.vue` report listener → `unreadApprovedReport` computed → reward popup shown to user
4. User clicks "Thu Tiền Về Ví" → `handleThuTienVeVi` increments balance via `increment()` and sets `status: 'collected'`

### Admin panel (`/admin`)

**Access control**: email hardcoded as `nguyenvanca14062001@gmail.com` OR `users/{uid}.role === 'admin'` in Firestore.

**Tabs:**
- `app_jobs` — VIP jobs (bank/stock apps), classified by `isAppJob()` which matches keywords: `app`, `ngân hàng`, `chứng khoán`, `vpbank`, `tpbank`, `msb`, `kafi`, `dnse`, `kis`
- `other_jobs` — basic interaction jobs; supports bulk approve (checkbox + batch write)
- `withdrawals` — approve marks `status: 'approved'`; reject refunds XU via `increment()` and clears `hasPendingWithdraw` flag

**Other admin features:**
- Search by username or phone (`phoneRef` field)
- `siteFilter` — filter by `site` field on documents
- Stats dashboard: counts today's approved+collected reports; breakdown by app campaign
- Daily notes ledger: "Chốt sổ" button saves snapshot to `admin_notes` collection
- `fixUserWallet()` — manually override a user's balance (writes exact number, not increment)

**Key fields admin reads from `usersMap`:** `username`, `balance`, `dateOfBirth`/`dob`/`ngaysinh`, `role`, `site`

**Key fields admin reads from reports:** `birthYear` (submitted by user, for age cross-check against `users.dateOfBirth`)

### localStorage keys
- `mmo_username`, `mmo_balance` — cached for instant display before Firestore hydrates
- `mmo_balance_hide` — toggle to mask balance in header
- `mmo_dismissed_rejections`, `mmo_dismissed_messages`, `mmo_dismissed_approvals` — track which admin notification popups the user has already seen

### Path aliases
`@` resolves to `src/`. All router imports use `@ts-ignore` (intentional, not a bug to fix).

### Deployment
`npm run deploy` builds and pushes `dist/` to GitHub Pages. The Vite `base` is `/` because the repo is a GitHub user page (`mmopro.github.io`), not a project page.

## Known issues

- `approveReport()` in AdminView uses read-then-write for balance update instead of `increment()` — race condition risk if two admins approve simultaneously or user collects at the same time. `bulkApproveOtherJobs()` already uses `increment()` correctly.
- Several `.vue` files were previously corrupted with AI-generated markdown text at the top of the file (before the `<script>` tag). Files already fixed: `JobSection.vue`, `SubmitReportView.vue`. If a file fails to compile, check if there is markdown preamble text before `<script setup>`.
## Quy tắc bắt buộc
- Khi sửa UI: CHỈ được đụng vào class CSS, màu sắc, font
- KHÔNG được sửa bất kỳ function, logic, firebase nào
- KHÔNG được thêm/xóa component nếu không được yêu cầu rõ ràng