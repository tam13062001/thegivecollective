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
    clicks: { type: Number, default: 0 }, // Chỉ có data thật cho Facebook, Instagram không có metric này ở cấp bài viết
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