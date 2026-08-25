// Cấu hình bật/tắt/tạm dừng/ẩn riêng cho job "ĐĂNG BÀI THREADS" (jobId thật: 'post-threads').
// KHÔNG liên quan đến job "ĐĂNG BÀI THREAD HẰNG NGÀY" (jobId 'daily_threads', collection daily_thread_reports).

export const POST_THREADS_JOB_ID = 'post-threads'
export const POST_THREADS_CONFIG_COLLECTION = 'basic_job_configs'
export const POST_THREADS_CONFIG_DOC_ID = 'dang_bai_threads'

export type PostThreadsJobStatus = 'open' | 'paused' | 'hidden'

export interface PostThreadsJobConfig {
  title: string
  status: PostThreadsJobStatus
  visible: boolean
}

export const POST_THREADS_CONFIG_DEFAULT: PostThreadsJobConfig = {
  title: 'ĐĂNG BÀI THREADS',
  status: 'open',
  visible: true,
}

export function normalizePostThreadsConfig(raw: any): PostThreadsJobConfig {
  const status: PostThreadsJobStatus = raw?.status === 'paused' || raw?.status === 'hidden' ? raw.status : 'open'
  return {
    title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title : POST_THREADS_CONFIG_DEFAULT.title,
    status,
    visible: raw?.visible === false ? false : true,
  }
}
