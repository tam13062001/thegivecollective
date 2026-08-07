import mongoose from 'mongoose';

// Schema map theo đúng field mà scraperService/controller đang dùng.
// Nếu GA4Stat gốc có field/type khác (vd Number vs String cho id...), sửa lại cho khớp.
const trafficSourceSchema = new mongoose.Schema(
  {
    source: String,
    medium: String,
    sessions: Number,
    users: Number,
  },
  { _id: false }
);

const countrySchema = new mongoose.Schema(
  {
    country: String,
    users: Number,
    sessions: Number,
  },
  { _id: false }
);

const ageBracketSchema = new mongoose.Schema(
  {
    age: String,
    users: Number,
  },
  { _id: false }
);

const genderSchema = new mongoose.Schema(
  {
    gender: String,
    users: Number,
  },
  { _id: false }
);

const topPageSchema = new mongoose.Schema(
  {
    path: String,
    views: Number,
    users: Number,
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
    totalKeyEvents: { type: Number, default: 0 },
    qualifyLeads: { type: Number, default: 0 },
    closeConvertLeads: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
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