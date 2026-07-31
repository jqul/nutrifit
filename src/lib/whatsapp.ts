export function buildWAUrl(phone: string, text: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`
}
