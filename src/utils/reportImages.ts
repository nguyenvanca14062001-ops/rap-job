export type ReportImage = {
  url: string
  path: string | null
  type: 'storage' | 'base64'
}

export function getReportImages(report: any): ReportImage[] {
  if (Array.isArray(report?.proofImages) && report.proofImages.length > 0) {
    return report.proofImages.map((img: any) => ({
      url: img.url,
      path: img.path ?? null,
      type: 'storage'
    }))
  }

  if (Array.isArray(report?.images) && report.images.length > 0) {
    return report.images.map((base64: string) => ({
      url: base64,
      path: null,
      type: 'base64'
    }))
  }

  return []
}
