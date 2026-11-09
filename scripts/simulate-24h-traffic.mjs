/**
 * Script gửi dữ liệu mô phỏng 24 giờ qua lên Basin Catalog Stream Endpoint
 * Endpoint: https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com
 */

import https from 'https';

const STREAM_ENDPOINT = 'https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com';

const COUNTRIES = [
  'VN', 'VN', 'VN', 'VN', 'VN', // Việt Nam chiếm tỷ lệ lớn
  'US', 'US', 'US',             // Mỹ
  'JP', 'JP',                   // Nhật Bản
  'SG', 'SG',                   // Singapore
  'KR',                         // Hàn Quốc
  'DE',                         // Đức
  'FR',                         // Pháp
  'GB',                         // Anh
  'AU',                         // Úc
  'CA'                          // Canada
];

const DEVICES = [
  'Mobile', 'Mobile', 'Mobile', 'Mobile', // Mobile chiếm đa số
  'Desktop', 'Desktop', 'Desktop',
  'Tablet'
];

const PATHS = [
  '/',
  '/shop',
  '/category/ca-phe-phin',
  '/category/ca-phe-dac-san',
  '/product/robusta-buon-ma-thuot',
  '/product/arabica-cau-dat',
  '/product/blend-phin-viet',
  '/cart',
  '/checkout',
  '/about',
  '/blog'
];

const REFERRERS = [
  'https://www.google.com/',
  'https://www.facebook.com/',
  'https://www.instagram.com/',
  'https://www.tiktok.com/',
  'https://m.facebook.com/',
  'direct'
];

function generateEvents(count = 50) {
  const events = [];
  const now = Date.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // Random thời gian trong vòng 24 giờ qua
    const offsetMs = Math.floor(Math.random() * (TWENTY_FOUR_HOURS_MS - 60000));
    const eventTime = now - offsetMs;

    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const device = DEVICES[Math.floor(Math.random() * DEVICES.length)];
    const path = PATHS[Math.floor(Math.random() * PATHS.length)];
    const referrer = REFERRERS[Math.floor(Math.random() * REFERRERS.length)];

    const ip = `118.${Math.floor(Math.random() * 100 + 50)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    events.push({
      id: `sim-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`,
      country,
      device,
      time: eventTime,
      ip,
      meta: {
        path,
        referrer,
        simulation: true,
        batchId: `batch-${Date.now()}`,
      },
    });
  }

  // Sắp xếp theo thứ tự thời gian tăng dần
  return events.sort((a, b) => a.time - b.time);
}

async function sendBatchToStream(events) {
  const payload = JSON.stringify(events);

  return new Promise((resolve, reject) => {
    const req = https.request(
      STREAM_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function main() {
  const eventCount = 60;
  console.log(`\n===============================================================`);
  console.log(`[Basin Stream] Bắt đầu tạo ${eventCount} sự kiện truy cập mẫu trong 24h qua...`);
  console.log(`Endpoint: ${STREAM_ENDPOINT}`);
  console.log(`===============================================================\n`);

  const events = generateEvents(eventCount);

  // Thống kê nhanh payload trước khi gửi
  const countryCounts = {};
  const deviceCounts = {};
  for (const ev of events) {
    countryCounts[ev.country] = (countryCounts[ev.country] || 0) + 1;
    deviceCounts[ev.device] = (deviceCounts[ev.device] || 0) + 1;
  }

  console.log('Phân bổ Quốc Gia dự kiến:', countryCounts);
  console.log('Phân bổ Thiết Bị dự kiến:', deviceCounts);
  console.log(`Thời gian từ: ${new Date(events[0].time).toISOString()}`);
  console.log(`Thời gian đến: ${new Date(events[events.length - 1].time).toISOString()}`);
  console.log(`\nĐang gửi payload JSON (${Buffer.byteLength(JSON.stringify(events))} bytes) lên Basin Stream...`);

  try {
    const response = await sendBatchToStream(events);
    console.log(`\nKẾT QUẢ PHẢN HỒI TỪ CLOUDFLARE BASIN:`);
    console.log(`Status Code : ${response.statusCode}`);
    console.log(`Body        :`, JSON.stringify(response.body, null, 2));

    if (response.statusCode === 200 && response.body?.success) {
      console.log(`\n🎉 THÀNH CÔNG! Đã stream ${response.body.result?.committed || events.length} sự kiện vào Basin Catalog.`);
    } else {
      console.error(`\n❌ THẤT BẠI:`, response.body);
    }
  } catch (error) {
    console.error(`\n❌ LỖI KẾT NỐI:`, error.message);
  }
}

main();

