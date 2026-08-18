export type CompressedImage = { dataUrl: string; blob: Blob; quality: number; width: number }

// Giới hạn cứng theo Storage Rules (request.resource.size < 1MB) — vượt mức này Storage sẽ từ chối upload
export const MAX_UPLOAD_BYTES = 1 * 1024 * 1024
// Mục tiêu nén, chừa biên an toàn dưới mức cứng ở trên
export const TARGET_UPLOAD_BYTES = 900 * 1024

// Nấc thang giảm dần, nhóm theo width để chỉ resize/drawImage 1 lần mỗi nấc width rồi thử nhiều
// mức quality trên cùng canvas đó (drawImage lại từ ảnh gốc ở mỗi mức quality tốn CPU/thời gian
// vô ích vì kích thước không đổi) — thử nét nhất trước, hạ dần nếu vẫn vượt TARGET_UPLOAD_BYTES
const COMPRESSION_STEPS: { maxWidth: number; qualities: number[] }[] = [
  { maxWidth: 1280, qualities: [0.75, 0.6] },
  { maxWidth: 1024, qualities: [0.6, 0.45] },
  { maxWidth: 800, qualities: [0.45, 0.35] }
]

// Log timing tạm thời để đo bottleneck thực tế (nén ảnh / upload / getDownloadURL / Firestore) —
// dùng performance.now() thay vì console.time/timeEnd vì compress chạy song song nhiều ảnh cùng
// lúc (Promise.all), console.time với label trùng nhau sẽ ghi đè/cảnh báo lẫn nhau.
export const perfMark = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())
export const perfLog = (label: string, start: number): number => {
  const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start)
  console.log(`[proof-upload] ${label}: ${ms}ms`)
  return ms
}

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

// Decode ảnh trực tiếp từ File/Blob bằng createImageBitmap — nhanh hơn nhiều so với
// FileReader.readAsDataURL (vốn phải base64-encode toàn bộ file gốc, có thể 5-10MB trên ảnh chụp
// điện thoại, rồi mới decode lại qua thẻ <img>). Giữ imageOrientation: 'from-image' để hành vi
// xoay ảnh theo EXIF tương đương cách trình duyệt hiển thị <img> trước đây.
const decodeImageSource = async (file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // Rơi xuống fallback bên dưới nếu trình duyệt không hỗ trợ option hoặc decode lỗi
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Ảnh bị lỗi, không thể đọc được.'))
      el.src = objectUrl
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(objectUrl) }
  } catch (err) {
    URL.revokeObjectURL(objectUrl)
    throw err
  }
}

export const compressImage = (file: File): Promise<CompressedImage> => {
  return (async () => {
    const tStart = perfMark()
    const { source, width: srcWidth, height: srcHeight, close } = await decodeImageSource(file)

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Không thể xử lý ảnh trên trình duyệt này.')
      }

      let bestBlob: Blob | null = null
      let bestQuality = 0.75
      let bestWidth = 1280

      outer:
      for (const step of COMPRESSION_STEPS) {
        let width = srcWidth
        let height = srcHeight
        if (width > step.maxWidth) {
          height = Math.round((height * step.maxWidth) / width)
          width = step.maxWidth
        }
        canvas.width = width
        canvas.height = height
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(source, 0, 0, width, height)

        for (const quality of step.qualities) {
          const blob = await canvasToBlob(canvas, quality)
          if (!blob) continue
          bestBlob = blob
          bestQuality = quality
          bestWidth = width
          if (blob.size <= TARGET_UPLOAD_BYTES) break outer
        }
      }

      if (!bestBlob) {
        throw new Error('Không thể nén ảnh, vui lòng thử ảnh khác.')
      }

      // canvas đang giữ đúng trạng thái (width/height) của bestBlob vì được vẽ lại mỗi nấc trước khi encode
      const dataUrl = canvas.toDataURL('image/jpeg', bestQuality)
      perfLog(`Nén ảnh "${file.name}" (${Math.round(file.size / 1024)}KB gốc → ${Math.round(bestBlob.size / 1024)}KB)`, tStart)
      return { dataUrl, blob: bestBlob, quality: bestQuality, width: bestWidth }
    } finally {
      close()
    }
  })()
}
