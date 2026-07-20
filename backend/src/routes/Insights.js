// routes/insights.js
import express from 'express';
import { getIgAudienceDemographics, getFanOnline } from '../services/igDemographics.js';
import OnlineFollowersSnapshot from '../models/OnlineFollowersSnapshot.js';
import TimeEngagementWeekly from '../models/temp.js';
import TimeEngagementMonthly from '../models/TimeEngagementMonthly.js';

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

    // Khởi tạo URL ban đầu
    let currentUrl = `https://graph.facebook.com/v19.0/${ig_user_id}/insights?metric=online_followers&period=lifetime&access_token=${access_token}`;
    
    let fbData = null;
    let rawValues = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 3; // Giới hạn lội ngược dòng tối đa 3 ngày để tránh loop vô hạn nếu tài khoản chết hẳn

    // Vòng lặp tự động tìm kiếm lội ngược dòng nếu gặp dữ liệu rỗng
    while (attempts < MAX_ATTEMPTS && currentUrl) {
      console.log(`Đang gọi API (Lần thử ${attempts + 1}): ${currentUrl}`);
      
      const fbResponse = await fetch(currentUrl);
      fbData = await fbResponse.json();

      if (fbData.error) {
        return res.status(400).json({ success: false, message: fbData.error.message });
      }

      if (!fbData.data || fbData.data.length === 0) {
        return res.status(404).json({ success: false, message: "Không có dữ liệu insight từ Meta" });
      }

      // Tìm phần tử có chứa value và value đó KHÔNG ĐƯỢC RỖNG ({})
      rawValues = fbData.data[0].values?.find(v => v.value && Object.keys(v.value).length > 0);

      if (rawValues) {
        // Đã tìm thấy ngày có dữ liệu hợp lệ! Thoát vòng lặp ngay.
        console.log(`Thành công! Tìm thấy dữ liệu hợp lệ tại ngày: ${rawValues.end_time}`);
        break;
      }

      // Nếu chạy đến đây tức là ngày này bị rỗng ({}) -> Chuẩn bị lội về ngày trước
      console.warn(`Ngày hiện tại bị rỗng data. Tiến hành lội ngược dòng bằng link 'previous'...`);
      currentUrl = fbData.paging?.previous || null;
      attempts++;
    }

    // Sau khi kết thúc vòng lặp mà vẫn không tìm thấy gì (quá 3 ngày đều rỗng)
    if (!rawValues) {
      return res.status(404).json({ 
        success: false, 
        message: `Đã thử lội ngược dòng ${MAX_ATTEMPTS} ngày nhưng toàn bộ dữ liệu giờ online đều rỗng.` 
      });
    }

    // --- TIẾP TỤC THỰC THI THUẬT TOÁN (Vì đã chắc chắn có rawValues) ---
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

    const dataToSave = {
      recommended_vn_times,
      top_hours_detail: top3BestTimes,
      full_day_stats: processedHours,
      data_fetched_at: rawValues.end_time // Lưu thêm mốc thời gian thực tế lấy được để dễ check
    };

    // Lưu hoặc cập nhật vào MongoDB
    await OnlineFollowersSnapshot.findOneAndUpdate(
      { ig_user_id: ig_user_id },
      { $set: dataToSave },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: `Lấy và lưu dữ liệu thành công (Dữ liệu thực tế của ngày ${rawValues.end_time})`,
      data: dataToSave
    });

  } catch (error) {
    console.error("Lỗi tại /time-engagement:", error);
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

router.get('/time-engagement-monthly', async (req, res) => {
  try {
    const ig_user_id = '17841422427064625';
    const access_token = process.env.META_ACCESS_TOKEN_INSTAGRAM;
    const TIMEZONE_OFFSET_VN = 14;

    let url = `https://graph.facebook.com/v19.0/${ig_user_id}/insights?metric=online_followers&period=lifetime&access_token=${access_token}`;
    const dailyMap = new Map();

    let guard = 0;
    // Lấy hết dữ liệu có thể (IG thường giữ tối đa ~30 ngày cho metric này)
    while (url && guard < 15) {
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
      await new Promise(r => setTimeout(r, 300));
    }

    if (dailyMap.size === 0) {
      return res.status(404).json({ success: false, message: 'Chưa có dữ liệu' });
    }

    const weekdayNames = ['Chủ Nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];

    // monthKey -> weekdayLabel -> { hourSums, hourCounts } để tính trung bình
    const monthGroups = {};

    for (const [endTime, hourValues] of dailyMap.entries()) {
      const utcDate = new Date(endTime);
      const vnDate = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
      const weekdayLabel = weekdayNames[vnDate.getUTCDay()];
      const monthKey = `${vnDate.toLocaleString('en-US', { month: 'short' })}-${vnDate.getUTCFullYear()}`; // vd: Jan-2022

      if (!monthGroups[monthKey]) monthGroups[monthKey] = {};
      if (!monthGroups[monthKey][weekdayLabel]) {
        monthGroups[monthKey][weekdayLabel] = { hourSums: {}, hourCounts: {} };
      }
      const bucket = monthGroups[monthKey][weekdayLabel];

      for (const [hour, count] of Object.entries(hourValues)) {
        const ptHour = parseInt(hour, 10);
        const vnHour = (ptHour + TIMEZONE_OFFSET_VN) % 24;
        bucket.hourSums[vnHour] = (bucket.hourSums[vnHour] || 0) + count;
        bucket.hourCounts[vnHour] = (bucket.hourCounts[vnHour] || 0) + 1;
      }
    }

    // Build kết quả: monthKey -> weekdayLabel -> { top3_vn_times, full_day_stats }
    const monthlyStats = {};
    for (const [monthKey, weekdayData] of Object.entries(monthGroups)) {
      monthlyStats[monthKey] = {};
      for (const [weekdayLabel, bucket] of Object.entries(weekdayData)) {
        const processedHours = Object.keys(bucket.hourSums)
          .map(hour => ({
            vn_hour: parseInt(hour, 10),
            followers_online: Math.round(bucket.hourSums[hour] / bucket.hourCounts[hour])
          }))
          .sort((a, b) => a.vn_hour - b.vn_hour); // sort theo giờ tăng dần, hợp cho heatmap

        const top3 = [...processedHours]
          .sort((a, b) => b.followers_online - a.followers_online)
          .slice(0, 3)
          .map(t => `${t.vn_hour}:00`);

        monthlyStats[monthKey][weekdayLabel] = {
          top3_vn_times: top3,
          full_day_stats: processedHours
        };
      }
    }

    // Lưu riêng từng tháng, không ghi đè các tháng đã lưu trước đó
    const updateOps = { updated_at: new Date() };
    for (const [monthKey, data] of Object.entries(monthlyStats)) {
      updateOps[`monthlyStats.${monthKey}`] = data;
    }

    await TimeEngagementMonthly.findOneAndUpdate(
      { ig_user_id },
      { $set: updateOps },
      { returnDocument: 'after', upsert: true } // đổi ở đây
    );

    return res.status(200).json({
      success: true,
      message: `Gộp được dữ liệu cho ${Object.keys(monthlyStats).length} tháng (${dailyMap.size} ngày)`,
      data: monthlyStats
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});
export default router;