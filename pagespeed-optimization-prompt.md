# PageSpeed Optimization — blog.tvphus.dev (v2)
**Stack:** Astro 6 + Cloudflare Pages + @fontsource + TailwindCSS v4 + DaisyUI  
**Dựa trên:** source-report.md + PageSpeed Insights report

---

## Tổng quan vấn đề (đã xác nhận từ source)

| Vấn đề | Nguyên nhân thực tế | Tiết kiệm ước tính |
|---|---|---|
| Font chain 451ms | `global.css` import 9 file @fontsource (7 weight Inter + 2 weight JetBrains) | ~300ms |
| CSS render-blocking 630ms | `BaseLayout.css` 36.6KB, chứa toàn bộ font + Tailwind | ~400ms |
| LCP delay 2,270ms | Hệ quả của 2 vấn đề trên | ~1,500ms |
| Cache TTL ngắn | Chưa có file `public/_headers` | — |
| GitHub avatar CDN | `public/avatar.png` đã có nhưng đâu đó vẫn dùng URL githubusercontent | — |

**Không thực hiện:** Xóa `<ClientRouter />` — script theme dùng `astro:after-swap` để tránh FOUC khi navigate, nếu xóa ClientRouter sẽ bị lỗi.

---

## Task 1 — Giảm font weights (tác động lớn nhất)

### 1a. Xác định font weights nào thực sự được dùng

Tìm trong toàn bộ `src/` (CSS + Astro + TSX) các class hoặc property sau:
- Tailwind: `font-light` (300), `font-normal` (400), `font-medium` (500), `font-semibold` (600), `font-bold` (700), `font-extrabold` (800), `font-black` (900)
- CSS thuần: `font-weight: 300/400/500/600/700/800/900`

Liệt kê ra những weight nào thực sự được dùng trước khi làm bước tiếp theo.

### 1b. Cập nhật `src/styles/global.css`

Xóa các `@import` của weight không dùng. Chỉ giữ lại weight thực sự cần.

**Thay đoạn hiện tại:**
```css
@import '@fontsource/inter/300.css';
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';
@import '@fontsource/inter/800.css';
@import '@fontsource/inter/900.css';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/600.css';
```

**Thành (chỉ giữ weight thực sự dùng, ví dụ nếu chỉ cần 400 và 700):**
```css
/* Inter — load đúng 2 subset cần thiết: latin (EN) + vietnamese (VI) */
@import '@fontsource/inter/latin-400.css';
@import '@fontsource/inter/vietnamese-400.css';
@import '@fontsource/inter/latin-700.css';
@import '@fontsource/inter/vietnamese-700.css';

/* JetBrains Mono — chỉ dùng cho code blocks, latin là đủ */
@import '@fontsource/jetbrains-mono/latin-400.css';
```

> **Quan trọng — tại sao cần cả `vietnamese` subset:**  
> Blog viết bằng tiếng Việt dùng các ký tự như `ắ`, `ặ`, `ầ`, `ử`, `ươ`... không có trong subset `latin` cơ bản. Nếu chỉ import `latin-*.css`, những ký tự này sẽ fallback về system font — font tiếng Việt và tiếng Anh sẽ trông không đồng nhất.  
> Subset an toàn để bỏ: `cyrillic` (tiếng Nga), `greek` (tiếng Hy Lạp) — những cái blog này rõ ràng không dùng.
>
> Nếu sau khi kiểm tra, một số weight thực sự cần thiết (ví dụ 500 cho UI), hãy thêm thêm cặp `latin-500.css` + `vietnamese-500.css`. Mục tiêu là giảm từ 9 file xuống còn 5 file.

### 1c. Xóa packages không dùng (tuỳ chọn, clean-up)

Trong `package.json`, các package sau được cài nhưng không import ở đâu:
- `@fontsource/lato`
- `@fontsource/source-sans-3`

Chạy: `bun remove @fontsource/lato @fontsource/source-sans-3`

---

## Task 2 — Preload font quan trọng nhất trong `<head>`

**File:** `src/layouts/BaseLayout.astro`

Thêm preload vào `<head>`, **ngay trước thẻ đóng `</head>`** hoặc sau `<meta>` tags và trước `<SEO />`:

```astro
---
// Thêm import này ở đầu frontmatter nếu cần resolve path
---

<head>
  <!-- ... các tag hiện có ... -->
  <meta name="theme-color" ... />
  <link rel="icon" ... />
  <link rel="alternate" ... />

  <!-- THÊM VÀO ĐÂY: Preload Inter latin 400 (font body chính) -->
  <!-- 
    Lưu ý: path font sau khi build có dạng /_astro/inter-latin-400-normal.HASH.woff2
    Cách lấy đúng path: sau khi chạy `bun run build`, tìm trong dist/_astro/ 
    file có tên chứa "inter-latin-400". Copy đúng tên file đó vào href bên dưới.
    Hash thay đổi mỗi lần build nên cần cập nhật nếu thêm/sửa font.
    
    Giải pháp bền vững hơn: xem Option B bên dưới.
  -->
  
  <SEO meta={meta} />
  <ClientRouter />
  <!-- ... script theme ... -->
</head>
```

**Option A — Hardcode path (đơn giản, cần cập nhật thủ công khi rebuild):**
```astro
<link
  rel="preload"
  as="font"
  type="font/woff2"
  href="/_astro/inter-latin-400-normal.HASH.woff2"
  crossorigin
/>
```
Thay `HASH` bằng hash thực sau khi build: `ls dist/_astro/ | grep inter-latin-400`

**Option B — Dùng Astro font API (bền vững, không cần cập nhật thủ công):**

Nếu muốn tự động, thêm vào `astro.config.mjs` trong block `experimental`:
```js
experimental: {
  fonts: [{
    provider: 'fontsource',
    name: 'Inter',
    cssVariable: '--font-inter',
    weights: [400, 700],  // chỉ weight cần thiết
    subsets: ['latin'],
    preload: true,        // tự động thêm <link rel="preload">
  }],
  // ... experimental options hiện có ...
}
```
Nếu dùng Option B, xóa các `@import '@fontsource/inter/...'` trong `global.css` vì Astro sẽ tự handle.

> **Chọn Option A nếu** muốn giải pháp nhanh, ít thay đổi.  
> **Chọn Option B nếu** muốn giải pháp tự động và bền vững hơn.

---

## Task 3 — Tạo file `public/_headers` (cache Cloudflare Pages)

**Tạo file mới:** `public/_headers`

```
# Astro static assets — có content hash trong tên, safe to cache 1 năm
/_astro/*
  Cache-Control: public, max-age=31536000, immutable

# Public assets (images, favicon, etc.)
/avatar.png
  Cache-Control: public, max-age=604800

/favicon.ico
  Cache-Control: public, max-age=604800

/og-default.png
  Cache-Control: public, max-age=604800

# HTML pages — không cache để nhận update ngay
/*
  Cache-Control: public, max-age=0, must-revalidate
```

> File `_headers` phải nằm trong `public/` — Cloudflare Pages sẽ tự đọc và áp dụng.  
> Các file trong `/_astro/*` đã có content hash → an toàn để cache `immutable` 1 năm.

---

## Task 4 — Tìm và thay thế GitHub avatar URL còn sót

`public/avatar.png` đã tồn tại, nhưng PageSpeed vẫn thấy request đến `avatars.githubusercontent.com`.

**Tìm trong toàn bộ `src/`:**
```bash
grep -r "githubusercontent.com" src/
grep -r "github.com/u/" src/
grep -r "avatars\." src/
```

Với mỗi kết quả tìm được, thay URL githubusercontent bằng `/avatar.png` (đường dẫn local).

Ví dụ:
```astro
<!-- Trước -->
<img src="https://avatars.githubusercontent.com/u/40559090?v=4" alt="Avatar" />

<!-- Sau -->
<img src="/avatar.png" alt="Avatar" width="40" height="40" />
```

---

## Task 5 — Defer Cloudflare Web Analytics beacon

**Tìm trong `src/layouts/BaseLayout.astro` hoặc các layout/component khác** dòng load Cloudflare beacon:
```html
<script src='https://static.cloudflareinsights.com/beacon.min.js' ...></script>
```

Đảm bảo có attribute `defer`:
```html
<script
  defer
  src="https://static.cloudflareinsights.com/beacon.min.js"
  data-cf-beacon='{"token": "YOUR_TOKEN"}'
></script>
```

Nếu không tìm thấy script này trong source (có thể được inject qua Cloudflare Dashboard), bỏ qua task này.

---

## Thứ tự thực hiện

```
Task 1a (kiểm tra font weights dùng thực tế)
  ↓
Task 1b (cập nhật global.css — xóa weight thừa, dùng latin subset)
  ↓
Task 2 (thêm preload font vào <head>)
  ↓
Task 3 (tạo public/_headers)
  ↓
Task 4 (fix GitHub avatar URL)
  ↓
Task 5 (defer beacon — nếu tìm thấy)
  ↓
Task 1c (bun remove unused font packages — optional)
```

---

## Kiểm tra sau khi hoàn thành

**Build và kiểm tra số file font:**
```bash
bun run build
ls dist/_astro/*.woff2 | wc -l   # Mục tiêu: ≤ 6 file (giảm từ ~14 file, giữ lại latin + vietnamese)
ls dist/_astro/*.woff2            # Xem tên để lấy hash cho Task 2 Option A
```

**Kiểm tra `_headers` được copy sang dist:**
```bash
cat dist/_headers   # Phải có nội dung đã viết
```

**Chạy lại PageSpeed Insights:** https://pagespeed.web.dev/analysis?url=https://blog.tvphus.dev

Metric cần cải thiện so với baseline:
- **LCP** < 2.5s (baseline: bị delay 2,270ms)
- **FCP** < 1.8s (baseline: bị block 630ms bởi CSS)

---

## Không làm những điều này

- **KHÔNG xóa `<ClientRouter />`** — script `applyTheme()` dùng `astro:after-swap`, xóa sẽ bị FOUC khi navigate
- **KHÔNG hardcode hash font** mà không kiểm tra sau khi build — hash thay đổi mỗi lần thay đổi font
- **KHÔNG defer toàn bộ `BaseLayout.css`** — CSS này chứa Tailwind và DaisyUI, defer sẽ gây FOUC nghiêm trọng
- **KHÔNG xóa weight font** khi chưa chạy Task 1a để xác nhận weight đó không được dùng
