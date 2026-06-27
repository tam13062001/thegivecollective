import cron from 'node-cron';
import Metric from '../models/Metric.js';
import fs from 'fs/promises'; // Import thêm module fs của Node.js
import path from 'path';

export async function triggerAutoScrape() {
  console.log('[AutoScrape] Bắt đầu tự động lấy dữ liệu mới nhất...');
  
  try {
    const metrics = await Metric.find({}, 'profileUrl');

    if (!metrics || metrics.length === 0) {
      console.log('[AutoScrape] Không có profile nào trong DB để cào dữ liệu.');
      return;
    }

    const urls = metrics
      .map(m => m.profileUrl)
      .filter(url => url !== null && url !== '');

    if (urls.length === 0) {
      console.log('[AutoScrape] Không tìm thấy URL hợp lệ.');
      return;
    }

    console.log(`[AutoScrape] Đang tiến hành gọi API cập nhật cho ${urls.length} profile...`);

    const apiUrl = 'https://thegivecollective-backend.vercel.app/api/v1/tasks';
    
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ urls: urls })
});

// Đọc text trước, sau đó mới parse
const rawText = await response.text();
console.log('[AutoScrape] Raw response:', rawText); // xem server trả về gì

let result;
try {
  result = JSON.parse(rawText);
} catch {
  console.error('[AutoScrape] Response không phải JSON:', rawText);
  return;
}

    // --------------------------------------------------------
    // ĐOẠN MỚI: GHI JSON RA FILE (log_scrape.json)
    // --------------------------------------------------------
    try {
      // Lấy thư mục gốc hiện tại và tạo đường dẫn file
      const logFilePath = path.resolve(process.cwd(), 'log_scrape.json');
      
      // Ghi data ra file (tham số null, 2 giúp format file JSON thụt lề cho đẹp, dễ đọc)
      await fs.writeFile(logFilePath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`[AutoScrape] 📝 Đã ghi chi tiết log ra file: ${logFilePath}`);
    } catch (fsError) {
      console.error('[AutoScrape] ❌ Lỗi khi ghi file JSON:', fsError.message);
    }
    // --------------------------------------------------------

    if (response.ok) {
      console.log(`[AutoScrape] ✅ Hoàn tất: ${result.message}`);
    } else {
      console.error('[AutoScrape] ⚠️ API trả về lỗi!');
    }

  } catch (error) {
    console.error('[AutoScrape] ❌ Lỗi hệ thống khi chạy AutoScrape:', error.message);
  }
}

// Set lại thời gian chạy thực tế khi đẩy lên production nhé!
// cron.schedule('30 23 * * *', () => {
//   triggerAutoScrape();
// });
