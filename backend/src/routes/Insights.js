// routes/insights.js
import express from 'express';
import { getIgAudienceDemographics, getFanOnline } from '../services/igDemographics.js';
import OnlineFollowersSnapshot from '../models/OnlineFollowersSnapshot.js';
import TimeEngagementWeekly from '../models/temp.js';
const router = express.Router();
const GRAPH_VERSION = 'v22.0';
const IG_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN_INSTAGRAM;
const IG_BUSINESS_ACCOUNT_ID = process.env.IG_BUSINESS_ACCOUNT_ID || '17841422427064625';

router.get('/demographics', async (req, res) => {
  try {
    const data = await getIgAudienceDemographics(IG_BUSINESS_ACCOUNT_ID);
    res.json(data);
  } catch (error) {
    console.error('Error fetching IG demographics:', error.message);
    res.status(502).json({ message: error.message });
  }
});

router.get('/time-engagement', async (req, res) => {
  try {
    const ig_user_id = '17841422427064625'; 
    const access_token = process.env.META_ACCESS_TOKEN_INSTAGRAM;

    // Gọi API của Meta
    const url = `https://graph.facebook.com/v19.0/${ig_user_id}/insights?metric=online_followers&period=lifetime&access_token=${access_token}`;
    const fbResponse = await fetch(url);
    const fbData = await fbResponse.json();

    if (fbData.error) {
      return res.status(400).json({ success: false, message: fbData.error.message });
    }

    const rawValues = fbData.data[0].values.find(v => Object.keys(v.value).length > 0);
    if (!rawValues) {
      return res.status(404).json({ success: false, message: 'Chưa có dữ liệu' });
    }

    // Xử lý thuật toán giờ
    const TIMEZONE_OFFSET_VN = 14; 
    const processedHours = Object.entries(rawValues.value)
      .map(([hour, count]) => {
        const ptHour = parseInt(hour, 10);
        const vnHour = (ptHour + TIMEZONE_OFFSET_VN) % 24; 
        return {
          pt_hour: ptHour,
          vn_hour: vnHour,
          followers_online: count
        };
      })
      .sort((a, b) => b.followers_online - a.followers_online);

    const top3BestTimes = processedHours.slice(0, 3);
    const recommended_vn_times = top3BestTimes.map(t => `${t.vn_hour}:00`);

    // Gói dữ liệu
    const dataToSave = {
      recommended_vn_times,
      top_hours_detail: top3BestTimes,
      full_day_stats: processedHours
    };

    // Lưu hoặc cập nhật vào MongoDB
    await OnlineFollowersSnapshot.findOneAndUpdate(
      { ig_user_id: ig_user_id },
      { $set: dataToSave },
      { new: true, upsert: true }
    );

    // Trả về cho client
    return res.status(200).json({
      success: true,
      message: "Lấy và lưu dữ liệu time engagement thành công",
      data: dataToSave
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

router.get('/time-engagement-weekly', async (req, res) => {
  try {
    const ig_user_id = '17841422427064625';
    const access_token = process.env.META_ACCESS_TOKEN_INSTAGRAM;
    const TIMEZONE_OFFSET_VN = 14; // PT -> VN, giữ nguyên logic cũ của bạn

    let url = `https://graph.facebook.com/v19.0/${ig_user_id}/insights?metric=online_followers&period=lifetime&access_token=${access_token}`;
    const dailyMap = new Map(); // end_time -> value object, tự dedupe

    let guard = 0;
    while (url && dailyMap.size < 7 && guard < 10) {
      guard++;
      const fbResponse = await fetch(url);
      const fbData = await fbResponse.json();

      if (fbData.error) {
        return res.status(400).json({ success: false, message: fbData.error.message });
      }

      const values = fbData.data?.[0]?.values || [];
      for (const v of values) {
        if (v.value && Object.keys(v.value).length > 0 && !dailyMap.has(v.end_time)) {
          dailyMap.set(v.end_time, v.value);
        }
      }

      url = fbData.paging?.previous || null;
      await new Promise(r => setTimeout(r, 300)); // tránh gọi quá nhanh bị rate limit
    }

    if (dailyMap.size === 0) {
      return res.status(404).json({ success: false, message: 'Chưa có dữ liệu' });
    }

    const weekdayNames = ['Chủ Nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
    const weeklyStats = {};

    for (const [endTime, hourValues] of dailyMap.entries()) {
      const utcDate = new Date(endTime);
      const vnDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
      const weekdayLabel = weekdayNames[vnDate.getUTCDay()];

      const processedHours = Object.entries(hourValues)
        .map(([hour, count]) => {
          const ptHour = parseInt(hour, 10);
          const vnHour = (ptHour + TIMEZONE_OFFSET_VN) % 24;
          return { vn_hour: vnHour, followers_online: count };
        })
        .sort((a, b) => b.followers_online - a.followers_online);

      weeklyStats[weekdayLabel] = {
        end_time: endTime,
        top3_vn_times: processedHours.slice(0, 3).map(t => `${t.vn_hour}:00`),
        full_day_stats: processedHours
      };
    }

    await TimeEngagementWeekly.findOneAndUpdate(
      { ig_user_id },
      { $set: { weeklyStats, updated_at: new Date() } },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: `Lấy được dữ liệu cho ${dailyMap.size}/7 ngày`,
      data: weeklyStats
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

export default router;