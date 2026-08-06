import mongoose from 'mongoose';

const ga4StatSchema = new mongoose.Schema(
  {
    websiteUrl: { type: String, default: '' },
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

    // Breakdown theo dimension
    trafficSources: [
      {
        source: String,
        medium: String,
        sessions: Number,
        users: Number,
        _id: false,
      },
    ],
    countries: [
      {
        country: String,
        users: Number,
        sessions: Number,
        _id: false,
      },
    ],
    ageBrackets: [
      {
        age: String,
        users: Number,
        _id: false,
      },
    ],
    genders: [
      {
        gender: String,
        users: Number,
        _id: false,
      },
    ],
    topPages: [
      {
        path: String,
        views: Number,
        users: Number,
        _id: false,
      },
    ],

    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('GA4Stat', ga4StatSchema);