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
    date: { type: String, default: '' },
    url: { type: String, required: true, unique: true },

    // Loại nội dung đã chuẩn hoá, dùng để filter/so sánh performance trên frontend
    contentType: {
      type: String,
      enum: CONTENT_TYPES,
      default: 'unknown',
    },

    // Giữ lại giá trị gốc từ platform để debug / re-map lại sau này nếu cần,
    // không bắt buộc và không dùng trực tiếp ở frontend
    rawMediaType: { type: String, default: '' },
    rawMediaProductType: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('AllPost', allPostSchema);