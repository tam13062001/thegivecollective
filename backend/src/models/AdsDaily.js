// models/AdsDaily.js — 1 dòng / ad / ngày (tab "Utd" của Google Sheet)
import mongoose from 'mongoose';

const adsDailySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // date_start|ad_id
    date_start: { type: String, index: true },
    campaign_name: String,
    adset_name: String,
    ad_name: String,
    ad_account_id: String,
    campaign_effective_status: String,
    adset_id: String,
    adset_effective_status: String,
    ad_id: String,
    ad_effective_status: String,
    status_fetched_at: String,
    spend: Number,
    impressions: Number,
    reach: Number,
    clicks: Number,
    inline_link_clicks: Number,
    landing_page_view: Number,
    initiate_checkout: Number,
    purchase: Number,
    purchase_value: Number,
    event_count__donate_total: Number,
    event_value__donate_total: Number,
    frequency: Number,
  },
  { timestamps: true },
);

export default mongoose.model('AdsDaily', adsDailySchema);
