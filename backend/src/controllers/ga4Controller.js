import GA4Stat from '../models/GA4Stat.js';
import { fetchGoogleAnalyticsStats } from '../services/scraperService.js';

// Chỉ track 1 website nên dùng 1 document duy nhất (singleton)
const getSingletonDoc = async () => {
  let doc = await GA4Stat.findOne();
  if (!doc) doc = await GA4Stat.create({});
  return doc;
};

export const getGA4Stats = async (req, res) => {
  try {
    const doc = await getSingletonDoc();
    res.status(200).json(doc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi hệ thống' });
  }
};

export const refreshGA4Stats = async (req, res) => {
  try {
    const stats = await fetchGoogleAnalyticsStats();
    if (stats.error) return res.status(502).json({ message: stats.error });

    const doc = await getSingletonDoc();
    doc.pageviews = stats.pageviews;
    doc.users = stats.users;
    doc.newUsers = stats.newUsers;
    doc.sessions = stats.sessions;
    doc.bounceRate = stats.bounceRate;
    doc.avgDuration = stats.avgDuration;
    doc.engagementRate = stats.engagementRate;
    doc.totalKeyEvents = stats.totalKeyEvents;
    doc.qualifyLeads = stats.qualifyLeads;
    doc.closeConvertLeads = stats.closeConvertLeads;
    doc.purchases = stats.purchases;
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
    res.status(500).json({ message: 'Lỗi hệ thống khi refresh GA4 stats' });
  }
};

export const updateGA4Website = async (req, res) => {
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