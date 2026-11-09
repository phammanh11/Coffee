/**
 * Script kiểm tra nhanh kết nối tới Basin Stream Endpoint với ID cố định 'coffeet1'
 * Endpoint: https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com
 */

import https from 'https';

const STREAM_ENDPOINT = 'https://f8fb6f6f730b404fb2f273fd789d04df.ingest.cloudflare.com';

const testEvent = [
  {
    id: 'coffeet1',
    country: 'VN',
    device: 'Desktop',
    time: Date.now(),
    ip: '118.69.100.20',
    meta: {
      action: 'health_check',
      source: 'test-basin-stream.mjs',
      website: 'coffeet1.pages.dev',
      system: 'MỘC Coffee E-Commerce',
      eventId: `ping-${Date.now()}`,
    },
  },
];

const payload = JSON.stringify(testEvent);

console.log(`[Test] Đang gửi kiểm tra với id='coffeet1' tới ${STREAM_ENDPOINT}...`);

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
        console.log("✅ Đã gửi thành công! Trên Cloudflare hãy query: SELECT * FROM <ten_bang> WHERE id = 'coffeet1';");
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
