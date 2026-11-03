// models/AdsBreakdown.js — 1 dòng / ad / ngày / nhóm tuổi, giới tính hoặc vị trí hiển thị (tab "Age", "Gender", "Placement")
import mongoose from 'mongoose';

const adsBreakdownSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // tab|segment|date_start|ad_id
    tab: { type: String, enum: ['age', 'gender', 'placement'], index: true },
    segment: String,
    date_start: { type: String, index: true },
    campaign_name: String,
    adset_name: String,
    ad_id: String,
    ad_name: String,
    spend: Number,
    impressions: Number,
    inline_link_clicks: Number,
    landing_page_view: Number,
    purchase: Number,
    purchase_value: Number,
  },
  { timestamps: true },
);

export default mongoose.model('AdsBreakdown', adsBreakdownSchema);
