import Metric from "../models/Metric.js"
import {fetchTikTokStats,fetchInstagramStats,fetchLinkedInStats,fetchMetaStats} from '../services/scraperService.js'


export const getAllMetric = async (req,res) =>{
    try{
        const metrics = await Metric.find();

        res.status(200).json(metrics);
    }
    catch(error){
        console.log(error);
        res.status(500).json({message : "loi he thong"});
    }
}


export const CreateMetric = async (req, res) => {
    try {
        // Nhận mảng URLs từ Frontend gửi lên: { "urls": ["https://facebook.com/...", "https://tiktok.com/..."] }
        const { urls } = req.body; 

        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ message: "Vui lòng cung cấp một mảng các đường link (urls)." });
        }

        const results = [];
        const errors = [];

        // Hàm phân tích URL để lấy Platform và Handle
        const parseSocialUrl = (url) => {
            try {
                const urlObj = new URL(url);
                const hostname = urlObj.hostname.toLowerCase();
                let pathname = urlObj.pathname;

                // Xóa dấu '/' ở cuối nếu có
                if (pathname.endsWith('/')) {
                    pathname = pathname.slice(0, -1);
                }

                let platform = '';
                let handle = '';

                if (hostname.includes('facebook.com')) {
                    platform = 'Facebook';
                    handle = pathname.split('/').pop(); 
                } 
                else if (hostname.includes('instagram.com')) {
                    platform = 'Instagram';
                    handle = pathname.split('/').pop();
                } 
                else if (hostname.includes('tiktok.com')) {
                    platform = 'Tiktok';
                    handle = pathname.split('/').pop(); // Lấy phần @username
                } 
                else if (hostname.includes('youtube.com')) {
                    platform = 'Youtube';
                    // Youtube có thể là /channel/ID hoặc /@username
                    handle = pathname.split('/').pop(); 
                } 
                else if (hostname.includes('linkedin.com')) {
                    platform = 'LinkedIn';
                    handle = pathname.split('/').pop(); 
                }
                else if (hostname.includes('threads.net')) {
                    platform = 'Threads';
                    handle = pathname.split('/').pop();
                }

                return { platform, handle };
            } catch (error) {
                return { platform: null, handle: null };
            }
        };
        // Lặp qua từng URL để xử lý
        for (const targetUrl of urls) {
            // 1. Phân tích URL lấy platform và handle
            const { platform, handle } = parseSocialUrl(targetUrl);

            if (!platform || !handle) {
                errors.push({ url: targetUrl, reason: "URL không hợp lệ hoặc không được hỗ trợ" });
                continue;
            }

            // 2. Lấy API Key/Token (Cái này bạn có thể lưu ở file .env hoặc query từ DB)
            // Ví dụ: process.env.APIFY_TOKEN, process.env.META_ACCESS_TOKEN...
            let stats = { followers: 0, posts: 0, views: 0 };
            let hasError = false;

            // 3. Gọi hàm scrape tương ứng với nền tảng
            switch (platform.toLowerCase()) {
                case 'tiktok':
                    stats = await fetchTikTokStats(handle, process.env.APIFY_TOKEN);
                    break;
                case 'facebook':
                    stats = await fetchMetaStats(handle, process.env.META_ACCESS_TOKEN);
                    break;
                case 'instagram':
                    stats = await fetchInstagramStats(handle, process.env.META_ACCESS_TOKEN);
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
                continue; // Bỏ qua, không lưu URL này vào DB
            }

            // 4. Lưu thông tin và Data vừa scrape được vào DB Mongoose
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

        // Trả về kết quả
        res.status(201).json({ 
            message: `Xử lý hoàn tất. Thành công: ${results.length}, Lỗi: ${errors.length}`,
            successData: results,
            failedData: errors
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Lỗi hệ thống khi tạo và scrape dữ liệu" });
    }
}

export const UpaateTask = (req,res) =>{
    res.status(201).json({message : "Upate thành công"});
}

export const DeleteTask = (req,res) =>{
    res.status(201).json({message : "xóa thành công"});
}