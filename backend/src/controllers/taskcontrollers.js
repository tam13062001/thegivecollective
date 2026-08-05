import Metric from "../models/Metric.js";
import { fetchTikTokStats, fetchInstagramStats, fetchLinkedInStats, fetchMetaStats, fetchYouTubeStats ,fetchGoogleAnalyticsStats  } from '../services/scraperService.js';

export const getAllMetric = async (req, res) => {
    try {
        const metrics = await Metric.find().sort({ createdAt: -1 }); // Nên sort mới nhất lên đầu
        res.status(200).json(metrics);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
}

export const CreateMetric = async (req, res) => {
    try {
        const { urls } = req.body;

        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ message: "Vui lòng cung cấp một mảng các đường link (urls)." });
        }

        const results = [];
        const errors = [];

        const parseSocialUrl = (url) => {
            try {
                // GA4 Property ID: chuỗi số thuần, VD "531129209" — không phải URL
                if (/^\d+$/.test(url.trim())) {
                    return { platform: 'GoogleAnalytics', handle: url.trim() };
                }

                const urlObj = new URL(url);
                const hostname = urlObj.hostname.toLowerCase();
                let pathname = urlObj.pathname;

                if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);

                let platform = '';
                let handle = pathname.split('/').pop();

                if (hostname.includes('facebook.com')) platform = 'Facebook';
                else if (hostname.includes('instagram.com')) platform = 'Instagram';
                else if (hostname.includes('tiktok.com')) platform = 'Tiktok';
                else if (hostname.includes('youtube.com')) platform = 'Youtube';
                else if (hostname.includes('linkedin.com')) platform = 'LinkedIn';
                else if (hostname.includes('threads.net')) platform = 'Threads';

                return { platform, handle };
            } catch (error) {
                return { platform: null, handle: null };
            }
        };

        for (const targetUrl of urls) {
            const { platform, handle } = parseSocialUrl(targetUrl);

            if (!platform || !handle) {
                errors.push({ url: targetUrl, reason: "URL không hợp lệ hoặc không được hỗ trợ" });
                continue;
            }

            let stats = { followers: 0, posts: 0, views: 0 };
            let hasError = false;

            switch (platform.toLowerCase()) {
                case 'googleanalytics':
                    stats = await fetchGoogleAnalyticsStats();
                    break;
                case 'tiktok':
                    stats = await fetchTikTokStats(handle, process.env.APIFY_TOKEN);
                    break;
                case 'facebook':
                    stats = await fetchMetaStats(handle, process.env.META_ACCESS_TOKEN);
                    break;
                case 'instagram':
                    stats = await fetchInstagramStats(handle, process.env.META_ACCESS_TOKEN_INSTAGRAM);
                    break;
                case 'youtube':
                    stats = await fetchYouTubeStats(handle, process.env.YOUTUBE_API_KEY);
                    break;
                case 'linkedin':
                    stats = await fetchLinkedInStats(handle, process.env.APIFY_TOKEN);
                    break;
                default:
                    hasError = true;
                    errors.push({ url: targetUrl, reason: `Chưa cấu hình hàm scrape cho ${platform}` });
                    break;
            }

            if (hasError || stats.error) {
                errors.push({ url: targetUrl, reason: stats.error || "Lỗi cào dữ liệu" });
                continue;
            }

            // KIỂM TRA XEM URL ĐÃ TỒN TẠI TRONG DB CHƯA
            let existingMetric = await Metric.findOne({ profileUrl: targetUrl });

            if (existingMetric) {
                // LOGIC: Nếu scrape ra 0, nhưng DB cũ có số > 0, thì lấy lại số cũ
                const finalPosts = (stats.posts === 0 && existingMetric.postsCount > 0) 
                    ? existingMetric.postsCount 
                    : stats.posts;

                const finalViews = (stats.views === 0 && existingMetric.viewsCount > 0) 
                    ? existingMetric.viewsCount 
                    : stats.views;

                // Cập nhật record đã có
                existingMetric.followersCount = stats.followers;
                existingMetric.postsCount = finalPosts;
                existingMetric.viewsCount = finalViews;
                existingMetric.scrapedAt = new Date(); // Cập nhật thời gian cào mới nhất

                await existingMetric.save();
                results.push(existingMetric);
            } else {
                // Tạo record mới nếu chưa có
                const newMetric = new Metric({
                    platformName: platform,
                    accountHandle: handle,
                    profileUrl: targetUrl,
                    followersCount: stats.followers,
                    postsCount: stats.posts,
                    viewsCount: stats.views
                });

                await newMetric.save();
                results.push(newMetric);
            }
        }

        res.status(201).json({
            message: `Xử lý hoàn tất. Thành công: ${results.length}, Lỗi: ${errors.length}`,
            successData: results,
            failedData: errors
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi hệ thống khi tạo và scrape dữ liệu" });
    }
}

// Cập nhật thủ công theo ID (Dùng khi bạn muốn sửa tay dữ liệu)
export const UpdateMetric = async (req, res) => {
    try {
        const { id } = req.params; // Lấy ID từ URL (VD: PUT /metrics/:id)
        const updateData = req.body; 

        const existingMetric = await Metric.findById(id);
        if (!existingMetric) {
            return res.status(404).json({ message: "Không tìm thấy dữ liệu để cập nhật" });
        }

        // Logic giữ lại dữ liệu cũ nếu người dùng truyền lên 0
        if (updateData.postsCount === 0 && existingMetric.postsCount > 0) {
            updateData.postsCount = existingMetric.postsCount;
        }
        if (updateData.viewsCount === 0 && existingMetric.viewsCount > 0) {
            updateData.viewsCount = existingMetric.viewsCount;
        }

        // Cập nhật Database
        const updatedMetric = await Metric.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true } // Trả về data mới sau khi update
        );

        res.status(200).json({ 
            message: "Cập nhật thành công", 
            data: updatedMetric 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi hệ thống khi cập nhật dữ liệu" });
    }
}

// Xóa theo ID
export const DeleteMetric = async (req, res) => {
    try {
        const { id } = req.params; // Lấy ID từ URL (VD: DELETE /metrics/:id)

        const deletedMetric = await Metric.findByIdAndDelete(id);

        if (!deletedMetric) {
            return res.status(404).json({ message: "Không tìm thấy dữ liệu để xóa" });
        }

        res.status(200).json({ 
            message: "Xóa thành công", 
            deletedId: id 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi hệ thống khi xóa dữ liệu" });
    }
}