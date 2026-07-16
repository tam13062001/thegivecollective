// models/TopPost.js
import mongoose from 'mongoose';

const topPostSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, unique: true }, // 'Facebook' | 'Instagram' | 'Tiktok' | 'Youtube'
    title: { type: String, default: '' },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    date: { type: String, default: '' },
    url: { type: String, default: '' },
  },
  { timestamps: true } // tự có createdAt/updatedAt
);

export default mongoose.model('TopPost', topPostSchema);