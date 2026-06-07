const CDN_BASE = "https://cdn.tvphus.dev";

/**
 * Nhận filename từ CDN (output_filename_only: true)
 * hoặc URL đầy đủ, trả về CDN URL với transform.
 */
export function cdnUrl(src: string, transforms = "f_auto,q_auto"): string {
  // Đã là URL đầy đủ (https://...) → giữ nguyên
  if (/^https?:\/\//i.test(src)) return src;
  // Public path (/images/...) → giữ nguyên
  if (src.startsWith("/")) return src;
  // Filename từ CDN → ghép CDN URL
  return `${CDN_BASE}/image/optimized/${src}`;
}