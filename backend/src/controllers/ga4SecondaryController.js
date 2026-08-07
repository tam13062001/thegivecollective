import GA4StatSecondary from '../models/GA4StatSecondary.js';
import GA4History from '../models/GA4History.js';
import { fetchGoogleAnalyticsStatsSecondary } from '../services/scraperService.js';

// Chỉ track 1 website (secondary) nên dùng 1 document duy nhất (singleton)
const getSingletonDoc = async () => {
  let doc = await GA4StatSecondary.findOne();
  if (!doc) doc = await GA4StatSecondary.create({});
  return doc;
};

export const getGA4StatsSecondary = async (req, res) => {
  try {
    const doc = await getSingletonDoc();
    res.status(200).json(doc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};

export const refreshGA4StatsSecondary = async (req, res) => {
  try {
    // ?days=7|14|30|90 — mặc định 30 nếu không truyền hoặc truyền sai
    const parsedDays = parseInt(req.query.days, 10);
    const days = [7, 14, 30, 90].includes(parsedDays) ? parsedDays : 30;

    const stats = await fetchGoogleAnalyticsStatsSecondary(days);
    if (stats.error) return res.status(502).json({ message: stats.error });

    const doc = await getSingletonDoc();
    doc.pageviews = stats.pageviews;
    doc.users = stats.users;
    doc.newUsers = stats.newUsers;
    doc.sessions = stats.sessions;
    doc.bounceRate = stats.bounceRate;
    doc.avgDuration = stats.avgDuration;
    doc.engagementRate = stats.engagementRate;
    doc.days = stats.days;
    doc.totalKeyEvents = stats.totalKeyEvents;
    doc.donationFunnel = stats.donationFunnel;
    doc.keyEventsBreakdown = stats.keyEventsBreakdown;
    doc.keyEventsBreakdownExcludeDirect = stats.keyEventsBreakdownExcludeDirect;
    doc.trafficSources = stats.trafficSources;
    doc.countries = stats.countries;
    doc.ageBrackets = stats.ageBrackets;
    doc.genders = stats.genders;
    doc.topPages = stats.topPages;
    doc.lastUpdated = new Date();
    await doc.save();

    res.status(200).json(doc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi hệ thống khi refresh GA4 stats (secondary)' });
  }
};

export const updateGA4WebsiteSecondary = async (req, res) => {
  try {
    const { websiteUrl } = req.body;
    if (!websiteUrl) return res.status(400).json({ message: 'Thiếu websiteUrl' });

    const doc = await getSingletonDoc();
    doc.websiteUrl = websiteUrl;
    await doc.save();
    res.status(200).json(doc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};

/**
 * Lưu snapshot GA4 của ngày hôm nay vào lịch sử (upsert)
 */
export const saveDailyGA4History = async (req, res) => {
  try {
    const stats = await fetchGoogleAnalyticsStatsSecondary();
    if (stats.error) {
      return res.status(502).json({ message: stats.error });
    }

    const today = new Date().toISOString().split('T')[0];

    const historyData = {
      date: today,
      websiteUrl: stats.websiteUrl || 'https://analytics.thegivecollective.com',
      pageviews: stats.pageviews,
      users: stats.users,
      newUsers: stats.newUsers,
      sessions: stats.sessions,
      bounceRate: stats.bounceRate,
      avgDuration: stats.avgDuration,
      engagementRate: stats.engagementRate,
      totalKeyEvents: stats.totalKeyEvents,
      qualifyLeads: stats.qualifyLeads,
      closeConvertLeads: stats.closeConvertLeads,
      purchases: stats.purchases,
      trafficSources: stats.trafficSources,
      countries: stats.countries,
      ageBrackets: stats.ageBrackets,
      genders: stats.genders,
      topPages: stats.topPages,
    };

    const result = await GA4History.findOneAndUpdate(
      { date: today },
      historyData,
      { upsert: true, new: true }
    );

    res.status(200).json({ message: `Saved snapshot for ${today}`, data: result });
  } catch (error) {
    console.error('[GA4 History] Save error:', error);
    res.status(500).json({ message: 'Lỗi lưu lịch sử GA4' });
  }
};

/**
 * Lấy dữ liệu lịch sử trong khoảng ngày
 * Query: ?days=30 (mặc định 30)
 */
export const getGA4History = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split('T')[0];

    const history = await GA4History.find(
      { date: { $gte: sinceStr } },
      { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 }
    ).sort({ date: 1 });

    res.status(200).json(history);
  } catch (error) {
    console.error('[GA4 History] Get error:', error);
    res.status(500).json({ message: 'Lỗi lấy lịch sử GA4' });
  }
};