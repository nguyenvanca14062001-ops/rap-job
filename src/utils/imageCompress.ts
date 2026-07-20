export type CompressedImage = { dataUrl: string; blob: Blob; quality: number; width: number }

// Giới hạn cứng theo Storage Rules (request.resource.size < 1MB) — vượt mức này Storage sẽ từ chối upload
export const MAX_UPLOAD_BYTES = 1 * 1024 * 1024
// Mục tiêu nén, chừa biên an toàn dưới mức cứng ở trên
export const TARGET_UPLOAD_BYTES = 900 * 1024

// Nấc thang giảm dần: thử nét nhất trước, nếu vẫn vượt TARGET_UPLOAD_BYTES thì hạ dần width/quality
const COMPRESSION_STEPS: { maxWidth: number; quality: number }[] = [
  { maxWidth: 1280, quality: 0.75 },
  { maxWidth: 1280, quality: 0.6 },
  { maxWidth: 1024, quality: 0.6 },
  { maxWidth: 1024, quality: 0.45 },
  { maxWidth: 800, quality: 0.45 },
  { maxWidth: 800, quality: 0.35 }
]

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

export const compressImage = (file: File): Promise<CompressedImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Không thể xử lý ảnh trên trình duyệt này.'))
          return
        }

        let bestBlob: Blob | null = null
        let bestQuality = 0.75
        let bestWidth = 1280

        for (const step of COMPRESSION_STEPS) {
          let width = img.width
          let height = img.height
          if (width > step.maxWidth) {
            height = Math.round((height * step.maxWidth) / width)
            width = step.maxWidth
          }
          canvas.width = width
          canvas.height = height
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)

          const blob = await canvasToBlob(canvas, step.quality)
          if (!blob) continue
          bestBlob = blob
          bestQuality = step.quality
          bestWidth = width
          if (blob.size <= TARGET_UPLOAD_BYTES) break
        }

        if (!bestBlob) {
          reject(new Error('Không thể nén ảnh, vui lòng thử ảnh khác.'))
          return
        }

        // canvas đang giữ đúng trạng thái (width/height) của bestBlob vì được vẽ lại mỗi bước trước khi encode
        const dataUrl = canvas.toDataURL('image/jpeg', bestQuality)
        resolve({ dataUrl, blob: bestBlob, quality: bestQuality, width: bestWidth })
      }
      img.onerror = () => { reject(new Error('Ảnh bị lỗi, không thể đọc được.')) }
    }
    reader.onerror = () => { reject(new Error('Không thể đọc file ảnh.')) }
  })
}
