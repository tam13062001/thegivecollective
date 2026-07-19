// utils/contentType.js
//
// Chuẩn hoá "content type" của một bài post về 1 tập enum thống nhất
// dùng chung cho toàn hệ thống (khớp với ContentType ở frontend):
//   'video' | 'image' | 'carousel' | 'story' | 'text' | 'unknown'
//
// Mỗi platform trả field gốc khác nhau nên cần map riêng:
// - Facebook  : attachments.data[0].media_type / type
//     photo -> image | video -> video | album -> carousel
//     share/link -> text | event -> unknown
// - Instagram : media_type (+ media_product_type)
//     media_product_type = STORIES -> story
//     media_product_type = REELS   -> video
//     media_type = IMAGE -> image | VIDEO -> video | CAROUSEL_ALBUM -> carousel
// - TikTok / YouTube: gần như luôn là video (trừ trường hợp TikTok post ảnh)

export const CONTENT_TYPES = ['video', 'image', 'carousel', 'story', 'text', 'unknown'];

/**
 * Map content type cho 1 post Facebook, dựa vào field `attachments`
 * lấy từ Graph API: ?fields=...,attachments{media_type,type}
 *
 * @param {object} attachments - object `attachments` trả về từ Graph API (post.attachments)
 * @returns {'video'|'image'|'carousel'|'text'|'unknown'}
 */
export function mapFacebookContentType(attachments) {
  const first = attachments?.data?.[0];
  if (!first) return 'unknown';

  // Facebook trả cả `media_type` lẫn `type`, ưu tiên media_type trước
  const raw = String(first.media_type || first.type || '').toLowerCase();

  switch (raw) {
    case 'photo':
      return 'image';
    case 'video':
      return 'video';
    case 'album':
      return 'carousel';
    case 'share':
    case 'link':
      return 'text';
    case 'event':
    default:
      return 'unknown';
  }
}

/**
 * Map content type cho 1 media Instagram, dựa vào `media_type` + `media_product_type`
 * lấy từ Graph API: ?fields=...,media_type,media_product_type
 *
 * media_product_type được ưu tiên trước vì nó phân biệt được Story/Reels,
 * còn media_type chỉ phân biệt được Image/Video/Carousel.
 *
 * @param {string} mediaType        - 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
 * @param {string} mediaProductType - 'FEED' | 'REELS' | 'STORIES'
 * @returns {'video'|'image'|'carousel'|'story'|'unknown'}
 */
export function mapInstagramContentType(mediaType, mediaProductType) {
  const mt = String(mediaType || '').toUpperCase();
  const mpt = String(mediaProductType || '').toUpperCase();

  if (mpt === 'STORIES') return 'story';
  if (mpt === 'REELS') return 'video';

  switch (mt) {
    case 'IMAGE':
      return 'image';
    case 'VIDEO':
      return 'video';
    case 'CAROUSEL_ALBUM':
      return 'carousel';
    default:
      return 'unknown';
  }
}

/**
 * TikTok: mặc định luôn là video. Một số tài khoản đăng "photo mode post"
 * (ảnh trượt) thì item từ Apify scraper thường có mảng `images`.
 *
 * @param {object} item - item gốc từ Apify tiktok-profile-scraper
 * @returns {'video'|'carousel'}
 */
export function mapTikTokContentType(item) {
  if (Array.isArray(item?.images) && item.images.length > 0) return 'carousel';
  return 'video';
}

/**
 * YouTube: 100% là video.
 * @returns {'video'}
 */
export function mapYouTubeContentType() {
  return 'video';
}