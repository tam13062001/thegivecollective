// models/GA4History.js
import mongoose from 'mongoose';

const trafficSourceSchema = new mongoose.Schema({
  source: String,
  medium: String,
  sessions: Number,
  users: Number,
}, { _id: false });

const countrySchema = new mongoose.Schema({
  country: String,
  users: Number,
  sessions: Number,
}, { _id: false });

const ageBracketSchema = new mongoose.Schema({
  age: String,
  users: Number,
}, { _id: false });

const genderSchema = new mongoose.Schema({
  gender: String,
  users: Number,
}, { _id: false });

const topPageSchema = new mongoose.Schema({
  path: String,
  views: Number,
  users: Number,
}, { _id: false });

const ga4HistorySchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD
    required: true,
    index: true,
    unique: true, // mỗi ngày chỉ 1 record
  },
  websiteUrl: { type: String, default: 'https://analytics.thegivecollective.com' },
  pageviews: { type: Number, default: 0 },
  users: { type: Number, default: 0 },
  newUsers: { type: Number, default: 0 },
  sessions: { type: Number, default: 0 },
  bounceRate: { type: Number, default: 0 },
  avgDuration: { type: Number, default: 0 },
  engagementRate: { type: Number, default: 0 },
  totalKeyEvents: { type: Number, default: 0 },
  qualifyLeads: { type: Number, default: 0 },
  closeConvertLeads: { type: Number, default: 0 },
  purchases: { type: Number, default: 0 },
  trafficSources: [trafficSourceSchema],
  countries: [countrySchema],
  ageBrackets: [ageBracketSchema],
  genders: [genderSchema],
  topPages: [topPageSchema],
}, { timestamps: true });

export default mongoose.model('GA4History', ga4HistorySchema);