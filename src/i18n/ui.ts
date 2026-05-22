/**
 * UI dictionaries.
 * Add new locales by adding a key to `messages` and to `SITE.locales` in
 * src/config.ts. All keys must exist for every locale (TypeScript enforces it).
 */

import type { Locale } from '../config';

export const messages = {
  en: {
    'site.skipToContent': 'Skip to content',
    'site.backToTop': 'Back to top',
    'nav.home': 'Home',
    'nav.posts': 'Posts',
    'nav.tags': 'Tags',
    'nav.categories': 'Categories',
    'nav.archives': 'Archives',
    'nav.about': 'About',
    'nav.search': 'Search',
    'nav.toggleMenu': 'Toggle menu',

    'theme.toggle': 'Toggle theme',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',

    'lang.switcher': 'Language',
    'lang.en': 'English',
    'lang.vi': 'Vietnamese',

    'post.publishedOn': 'Published on',
    'post.updatedOn': 'Updated on',
    'post.readingTime': 'min read',
    'post.toc': 'Table of contents',
    'post.tags': 'Tags',
    'post.categories': 'Categories',
    'post.previous': 'Previous',
    'post.next': 'Next',
    'post.comments': 'Comments',
    'post.commentsDisabled': 'Comments are disabled for this post.',
    'post.commentsSetupTitle': 'Comments need configuration',
    'post.commentsSetupBody':
      'Giscus is enabled but not yet configured. Add the repository details below to start collecting comments.',
    'post.commentsSetupStep1':
      'Visit `giscus.app` and select your public GitHub repository (Discussions must be enabled).',
    'post.commentsSetupStep2':
      'Copy the generated `data-repo-id`, `data-category` and `data-category-id` values.',
    'post.commentsSetupStep3':
      'Set the `PUBLIC_GISCUS_ENABLED`, `PUBLIC_GISCUS_REPO`, `PUBLIC_GISCUS_REPO_ID`, `PUBLIC_GISCUS_CATEGORY` and `PUBLIC_GISCUS_CATEGORY_ID` env vars in your `.env` file.',
    'post.commentsSetupStep4':
      'Rebuild the site — this notice will be replaced by the live comments thread.',
    'post.commentsSetupDocs': 'Open giscus.app',
    'post.share': 'Share',
    'post.copyLink': 'Copy link',
    'post.copied': 'Copied!',
    'post.author': 'Author',

    'list.allPosts': 'All posts',
    'list.empty': 'No posts found.',
    'list.tagPosts': 'Posts tagged',
    'list.categoryPosts': 'Posts in',
    'list.totalPosts': 'posts',
    'list.totalPostsOne': 'post',

    'pagination.previous': 'Previous page',
    'pagination.next': 'Next page',
    'pagination.page': 'Page',
    'pagination.of': 'of',

    'archives.title': 'Archives',
    'archives.empty': 'No posts yet.',

    'tags.title': 'Tags',
    'tags.empty': 'No tags yet.',

    'categories.title': 'Categories',
    'categories.empty': 'No categories yet.',

    'search.title': 'Search',
    'search.placeholder': 'Search the site',
    'search.openLabel': 'Open search',
    'search.closeLabel': 'Close search',
    'search.empty': 'No results.',
    'search.loading': 'Loading search…',
    'search.typeToStart': 'Type to search…',
    'search.hintShortcut': 'Press / anywhere to open search',
    'search.searching': 'Searching…',
    'search.noResultsFor': 'No results for',
    'search.resultsCount': 'results',
    'search.resultsCountOne': 'result',
    'search.hintNavigate': 'to navigate',
    'search.hintSelect': 'to open',
    'search.clearLabel': 'Clear',

    'code.copy': 'Copy',
    'code.copied': 'Copied',

    '404.title': 'Page not found',
    '404.description': 'The page you are looking for has flown away.',
    '404.cta': 'Back to home',

    'footer.poweredBy': 'Powered by',
    'footer.theme': 'Theme',
    'footer.privacy': 'Privacy Policy',
    'footer.copyright': 'All rights reserved.',
  },


  vi: {
    'site.skipToContent': 'Chuyển đến nội dung chính',
    'site.backToTop': 'Trở về đầu trang',
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
    'search.placeholder': 'Tìm kiếm trên trang web...',
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
    '404.description': 'Trang bạn đang tìm kiếm đã bay đi mất rồi.',
    '404.cta': 'Quay lại trang chủ',

    'footer.poweredBy': 'Phát triển trên nền tảng',
    'footer.theme': 'Giao diện',
    'footer.privacy': 'Chính sách bảo mật',
    'footer.copyright': 'Toàn bộ bản quyền được bảo lưu.',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type UIKey = keyof (typeof messages)['en'];
