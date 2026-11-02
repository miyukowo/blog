/**
 * Site-owned Vietnamese UI dictionary (Task 2).
 *
 * The upstream theme ships English + French dictionaries. This blog ships
 * English + Vietnamese, so the Vietnamese strings live here and are merged
 * into `messages` by `src/i18n/ui.ts`.
 *
 * The `Record<UIKey, string>` type makes dictionary coverage a compile-time
 * requirement: whenever upstream adds an English key, this file fails to
 * typecheck until the key is translated (or deliberately given the English
 * fallback value).
 */

import type { UIKey } from '../i18n/ui';

export const viMessages: Record<UIKey, string> = {
  'site.skipToContent': 'Chuyển đến nội dung chính',
  'site.scrollToTop': 'Lên đầu trang',
  'nav.home': 'Trang chủ',
  'nav.posts': 'Bài viết',
  'nav.tags': 'Thẻ',
  'nav.categories': 'Chuyên mục',
  'nav.archives': 'Lưu trữ',
  'nav.about': 'Giới thiệu',
  'nav.search': 'Tìm kiếm',
  'nav.toggleMenu': 'Bật/tắt menu',

  'theme.toggle': 'Thay đổi giao diện',
  'theme.light': 'Sáng',
  'theme.dark': 'Tối',
  'theme.system': 'Hệ thống',

  'lang.switcher': 'Ngôn ngữ',
  'lang.en': 'Tiếng Anh',
  'lang.vi': 'Tiếng Việt',

  'post.publishedOn': 'Đăng ngày',
  'post.updatedOn': 'Cập nhật ngày',
  'post.readingTime': 'phút đọc',
  'post.toc': 'Mục lục',
  'post.tags': 'Thẻ',
  'post.categories': 'Chuyên mục',
  'post.previous': 'Bài trước',
  'post.next': 'Bài tiếp theo',
  'post.comments': 'Bình luận',
  'post.commentsDisabled': 'Tính năng bình luận đã bị tắt cho bài viết này.',
  'post.commentsSetupTitle': 'Bình luận chưa được cấu hình',
  'post.commentsSetupBody':
    'Giscus đã được bật nhưng chưa cấu hình. Vui lòng thêm thông tin kho lưu trữ (repository) bên dưới để bắt đầu nhận bình luận.',
  'post.commentsSetupStep1':
    'Truy cập `giscus.app` và chọn kho lưu trữ GitHub công khai của bạn (phải bật tính năng Discussions).',
  'post.commentsSetupStep2':
    'Sao chép các giá trị `data-repo-id`, `data-category` và `data-category-id` được tạo ra.',
  'post.commentsSetupStep3':
    'Thiết lập các biến môi trường `PUBLIC_GISCUS_ENABLED`, `PUBLIC_GISCUS_REPO`, `PUBLIC_GISCUS_REPO_ID`, `PUBLIC_GISCUS_CATEGORY` và `PUBLIC_GISCUS_CATEGORY_ID` trong tệp `.env` của bạn.',
  'post.commentsSetupStep4':
    'Build lại trang web — thông báo này sẽ được thay thế bằng khung bình luận trực tiếp.',
  'post.commentsSetupDocs': 'Mở giscus.app',
  'post.share': 'Chia sẻ',
  'post.copyLink': 'Sao chép liên kết',
  'post.copied': 'Đã sao chép!',
  'post.author': 'Tác giả',

  'list.allPosts': 'Tất cả bài viết',
  'list.empty': 'Không tìm thấy bài viết nào.',
  'list.tagPosts': 'Bài viết được gắn thẻ',
  'list.categoryPosts': 'Bài viết trong chuyên mục',
  'list.totalPosts': 'bài viết',
  'list.totalPostsOne': 'bài viết',

  'pagination.previous': 'Trang trước',
  'pagination.next': 'Trang sau',
  'pagination.page': 'Trang',
  'pagination.of': 'trên',

  'archives.title': 'Lưu trữ',
  'archives.empty': 'Chưa có bài viết nào.',

  'tags.title': 'Thẻ',
  'tags.empty': 'Chưa có thẻ nào.',

  'categories.title': 'Chuyên mục',
  'categories.empty': 'Chưa có chuyên mục nào.',

  'search.title': 'Tìm kiếm',
  'search.placeholder': 'Tìm kiếm trên trang...',
  'search.openLabel': 'Mở tìm kiếm',
  'search.closeLabel': 'Đóng tìm kiếm',
  'search.empty': 'Không có kết quả.',
  'search.loading': 'Đang tải tìm kiếm…',
  'search.typeToStart': 'Nhập để tìm kiếm…',
  'search.hintShortcut': 'Nhấn / ở bất kỳ đâu để mở tìm kiếm',
  'search.searching': 'Đang tìm kiếm…',
  'search.noResultsFor': 'Không có kết quả cho',
  'search.resultsCount': 'kết quả',
  'search.resultsCountOne': 'kết quả',
  'search.hintNavigate': 'để di chuyển',
  'search.hintSelect': 'để mở',
  'search.clearLabel': 'Xóa',

  'code.copy': 'Sao chép',
  'code.copied': 'Đã sao chép',

  '404.title': 'Không tìm thấy trang',
  '404.description': 'Whoops. Trang bạn đang tìm kiếm đã bay đi mất rồi.',
  '404.cta': 'Quay lại trang chủ',

  'footer.poweredBy': 'Phát triển trên',
  'footer.theme': 'Theme',
  'footer.privacy': 'Chính sách bảo mật',
  'footer.copyright': 'Toàn bộ bản quyền được bảo lưu.',
};
