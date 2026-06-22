import mongoose from "mongoose";

const metricSchema = new mongoose.Schema(
  {
    platformName: {
      type: String,
      required: true,
      trim: true,
      // Gợi ý: Nếu danh sách nền tảng là cố định, bạn có thể bật enum lên để validate
      enum: ['Tiktok', 'Threads', 'LinkedIn', 'Twitter', 'Youtube', 'Instagram', 'Facebook'],
      default:"tiktok",
    },
    profileUrl: {
        type: String,
        required: true
    },
    accountHandle: {
      type: String,
      required: true,
      trim: true,
    },
    followersCount: {
      type: Number,
      default: 0,
      min: 0, // Đảm bảo số liệu không bị âm
    },
    postsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    scrapedAt: {
      type: Date,
      default: Date.now, // Tự động lưu thời gian khi document được tạo
    },
    // user_id: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'User', 
    //   required: true // Mở comment phần này nếu bạn cần liên kết dữ liệu này với 1 User/Profile cụ thể
    // }
  },
  {
    timestamps: true, // Tự động tạo thêm 2 trường createdAt và updatedAt
  }
);

// Tạo model từ schema
const Metric = mongoose.model("Metric", metricSchema);

export default Metric;