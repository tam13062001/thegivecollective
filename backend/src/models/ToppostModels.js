// models/TopPost.js
import mongoose from 'mongoose';

const topPostSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true }, // Bỏ unique: true ở đây
    title: { type: String, default: '' },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    date: { type: String, default: '' },
    url: { type: String, required: true, unique: true }, // Thêm unique cho URL
  },
  { timestamps: true }
);

export default mongoose.model('TopPost', topPostSchema);