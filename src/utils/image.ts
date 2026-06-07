const CDN_BASE = "https://cdn.tvphus.dev";
const CLOUDINARY_BASE = "https://res.cloudinary.com/tvphus/image/upload/";

/**
 * Nhận filename từ CDN (output_filename_only: true)
 * hoặc URL đầy đủ, trả về CDN URL với transform.
 */
export function cdnUrl(src: string): string {
  if (src.startsWith(CLOUDINARY_BASE)) {
    let pathAfterUpload = src.replace(CLOUDINARY_BASE, "");
    
    // Strip transformation prefix do Cloudinary thêm vào (f_auto,q_auto/)
    // Worker sẽ tự thêm lại, tránh bị duplicate như f_auto,q_auto/f_auto,q_auto/
    pathAfterUpload = pathAfterUpload.replace(
      /^(?:[a-z]+_[^/,]+(?:,[a-z]+_[^/,]+)*\/)+/,
      ""
    );
    
    return `${CDN_BASE}/image/optimized/${pathAfterUpload}`;
  }
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return src;
  return src;
}