import mongoose from 'mongoose';

const trafficSourceSchema = new mongoose.Schema(
  { source: String, medium: String, sessions: Number, users: Number },
  { _id: false }
);

const countrySchema = new mongoose.Schema(
  { country: String, users: Number, sessions: Number },
  { _id: false }
);

const ageBracketSchema = new mongoose.Schema(
  { age: String, users: Number },
  { _id: false }
);

const genderSchema = new mongoose.Schema(
  { gender: String, users: Number },
  { _id: false }
);

const topPageSchema = new mongoose.Schema(
  { path: String, views: Number, users: Number },
  { _id: false }
);

// Từng key event riêng lẻ trong list đầy đủ (không giới hạn số lượng)
const keyEventSchema = new mongoose.Schema(
  { eventName: String, count: Number },
  { _id: false }
);

// Funnel donate — 7 event cụ thể của thegivecollective.com, tên field rõ nghĩa
const donationFunnelSchema = new mongoose.Schema(
  {
    donateNowBtn: { type: Number, default: 0 },
    donorInfoForm: { type: Number, default: 0 },
    donationAmountEdit: { type: Number, default: 0 },
    tipEditButtonClick: { type: Number, default: 0 },
    checkoutBtnClick: { type: Number, default: 0 },
    donationPayment: { type: Number, default: 0 },
    donationConfirmation: { type: Number, default: 0 },
  },
  { _id: false }
);

const ga4StatSecondarySchema = new mongoose.Schema(
  {
    websiteUrl: { type: String, default: 'https://analytics.thegivecollective.com' },
    pageviews: { type: Number, default: 0 },
    users: { type: Number, default: 0 },
    newUsers: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    avgDuration: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    days: { type: Number, default: 30 }, // khoảng thời gian của lần refresh gần nhất
    totalKeyEvents: { type: Number, default: 0 },
    donationFunnel: { type: donationFunnelSchema, default: () => ({}) },
    keyEventsBreakdown: [keyEventSchema],
    keyEventsBreakdownExcludeDirect: [keyEventSchema], // MỚI: bảng lọc bỏ (direct)/(none)
    trafficSources: [trafficSourceSchema],
    countries: [countrySchema],
    ageBrackets: [ageBracketSchema],
    genders: [genderSchema],
    topPages: [topPageSchema],
    lastUpdated: Date,
  },
  { timestamps: true }
);

export default mongoose.model('GA4StatSecondary', ga4StatSecondarySchema);