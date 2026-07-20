export function normalizePhone(phone: any): string {
  return String(phone || '').replace(/[^\d]/g, '').trim()
}
