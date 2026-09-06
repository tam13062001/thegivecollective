// models/Allpost.js
import mongoose from 'mongoose';
import { CONTENT_TYPES } from '../utils/contentType.js';

const allPostSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true },
    title: { type: String, default: '' },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    // Facebook: post_clicks ở cấp bài viết.
    // Instagram: Graph API không có clicks cấp bài viết -> lấy profile_links_taps
    // (cấp tài khoản, theo ngày) và gán cho các bài đăng trong đúng ngày đó.
    clicks: { type: Number, default: 0 },
    // ctr = clicks / views * 100 (đơn vị %, làm tròn 2 chữ số thập phân)
    ctr: { type: Number, default: 0 },
    date: { type: String, default: '' },
    url: { type: String, required: true, unique: true },

    contentType: {
      type: String,
      enum: CONTENT_TYPES,
      default: 'unknown',
    },

    rawMediaType: { type: String, default: '' },
    rawMediaProductType: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('AllPost', allPostSchema);