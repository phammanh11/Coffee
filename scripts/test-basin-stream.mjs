/**
 * Script kiểm tra nhanh kết nối tới Basin Stream Endpoint
 * Endpoint: https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com
 */

import https from 'https';

const STREAM_ENDPOINT = 'https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com';

const testEvent = [
  {
    id: `ping-${Date.now()}`,
    country: 'VN',
    device: 'Desktop',
    time: Date.now(),
    ip: '118.69.100.20',
    meta: {
      action: 'health_check',
      source: 'test-basin-stream.mjs',
      system: 'MỘC Coffee E-Commerce',
    },
  },
];

const payload = JSON.stringify(testEvent);

console.log(`[Test] Đang gửi kiểm tra tới ${STREAM_ENDPOINT}...`);

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
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Response   : ${body}`);
      if (res.statusCode === 200) {
        console.log('✅ Kết nối Stream Endpoint hoạt động hoàn hảo!');
      } else {
        console.error('❌ Endpoint trả về lỗi:', res.statusCode);
      }
    });
  }
);

req.on('error', (err) => {
  console.error('❌ Lỗi kết nối:', err.message);
});

req.write(payload);
req.end();

