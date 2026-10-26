// ============================================================================
// MỘC COFFEE — RAG PIPELINE: CHUNKING -> WORD EMBEDDING -> VECTOR DB -> LLM
// Tích hợp trực tiếp các mô hình trên Cloudflare Workers AI:
//   - Word Embedding: @cf/baai/bge-m3 (hoặc @cf/baai/bge-base-en-v1.5)
//   - Chat LLM: @cf/meta/llama-3.3-70b-instruct-fp8-fast (hoặc @cf/qwen/qwen2.5-72b-instruct)
//   - Vector DB: Hỗ trợ đồng thời Cloudflare Vectorize (env.VECTORIZE) & Cloudflare D1 Vector Store (rag_chunks)
// ============================================================================

import type { WorkerEnv } from '../db/init';
import type { Product, RagRetrievedChunk, RagTraceInfo, ChatHistoryItem } from '../../shared/types';
import { formatVND } from '../../shared/constants';

export const DEFAULT_CF_EMBEDDING_MODEL = '@cf/baai/bge-m3';
export const DEFAULT_CF_LLM_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export interface RawDocumentSection {
  docId: string;
  category: 'brand' | 'advantage' | 'benefit' | 'policy' | 'brewing' | 'faq' | 'product';
  title: string;
  text: string;
  productSlug?: string | null;
}

export interface KnowledgeChunk {
  chunk_key: string;
  category: string;
  title: string;
  content: string;
  product_slug?: string | null;
}

// ----------------------------------------------------------------------------
// 1. KHO DỮ LIỆU TRI THỨC GỐC (KNOWLEDGE BASE SECTIONS)
// Đồng bộ 100% với tài liệu MOC_Coffee_Chatbot_Knowledge_Base.docx / .pdf
// ----------------------------------------------------------------------------
export const STATIC_KNOWLEDGE_DOCUMENTS: RawDocumentSection[] = [
  {
    docId: 'kb-brand-identity',
    category: 'brand',
    title: 'Thông tin thương hiệu, địa chỉ & liên hệ MỘC Coffee',
    text: `Thương hiệu MỘC Coffee có slogan chính thức là "Hương Vị Việt. Đánh Thức Đam Mê." (Good Coffee, Better Days) và triết lý cốt lõi "Hạt Mộc – Vị Nguyên Bản – Tâm Người Việt".
Xưởng rang & Văn phòng đặt tại: TP. Buôn Ma Thuột, Tỉnh Đắk Lắk và Showroom Quận 1 (Số 86 Nguyễn Huệ, Phường Bến Nghé), TP. Hồ Chí Minh.
Hotline & Zalo hỗ trợ khách hàng: 1900 6868 hoặc 0901 234 567.
Email chăm sóc khách hàng: hello@moccoffee.vn hoặc xin-chao@moccoffee.vn.
Giờ làm việc: Thứ Hai đến Thứ Bảy từ 08:00 – 20:00 (Trợ lý Barista Chatbot trực tuyến 24/7).`,
  },
  {
    docId: 'kb-advantages',
    category: 'advantage',
    title: 'Lợi thế cạnh tranh & Giá trị cốt lõi của MỘC Coffee',
    text: `MỘC Coffee sở hữu 5 lợi thế cạnh tranh vượt trội:
1. 100% Rang Mộc Nguyên Bản (Pure Roast): Tuyệt đối không tẩm bơ, không mỡ gà, không hương liệu hóa học, không caramel tạo màu và không độn đậu/bắp rang. Nước pha màu nâu hổ phách trong trẻo, bảo vệ sức khỏe và êm dịu với dạ dày.
2. Nguồn gốc vùng trồng minh bạch: Thu hái 100% trái chín đỏ từ các nông hộ liên kết tại Buôn Ma Thuột (Đắk Lắk, độ cao 500–800m), Đắk Mil (Đắk Nông), Cầu Đất (Đà Lạt, độ cao 1.500m), Mường Chanh (Sơn La) và Hướng Hóa (Quảng Trị).
3. Nghệ thuật rang mẻ nhỏ (Small-Batch Roasting): Rang mới mỗi ngày theo biểu đồ nhiệt (Roast Profile) riêng biệt cho từng giống hạt để đánh thức vị ngọt hậu tự nhiên.
4. Bao bì giấy Kraft khóa Zip & Van 1 chiều cao cấp: Giúp thoát khí CO2 tự nhiên sau khi rang và ngăn oxy xâm nhập, giữ trọn hương thơm suốt 45 ngày.
5. Hỗ trợ xay miễn phí theo đúng dụng cụ pha của khách hàng (5 cấp độ xay chuẩn Barista).`,
  },
  {
    docId: 'kb-customer-benefits',
    category: 'benefit',
    title: 'Quyền lợi khách hàng khi mua sắm tại MỘC Coffee',
    text: `Khi mua cà phê tại MỘC Coffee, khách hàng được hưởng trọn vẹn các quyền lợi:
- Miễn phí xay cà phê theo 5 cấp độ chuẩn: (1) Nguyên hạt, (2) Xay pha Phin truyền thống, (3) Xay pha Máy Espresso, (4) Xay Pour Over / V60, (5) Xay Cold Brew / French Press.
- Quyền lợi Đồng kiểm ngoại quan khi nhận hàng (COD): Được mở hộp kiểm tra gói cà phê nguyên niêm phong, đúng loại hạt, đúng khối lượng, đúng cỡ xay trước khi thanh toán tiền mặt cho bưu tá.
- Quyền lợi Miễn phí vận chuyển (Freeship) toàn quốc cho mọi đơn hàng từ 500.000₫ trở lên.
- Quyền lợi Đổi mới 100% miễn phí trong vòng 7 ngày nếu bao bì bị rách, hở van 1 chiều do vận chuyển hoặc shop gửi nhầm dòng sản phẩm / nhầm kiểu xay.
- Quyền lợi Tài khoản thành viên: Tự động đồng bộ lịch sử đơn hàng vãng lai theo Số điện thoại hoặc Email; lưu địa chỉ giao hàng mặc định; chủ động bấm Hủy đơn hàng trực tuyến khi đơn đang ở trạng thái "Chờ xác nhận" (pending).`,
  },
  {
    docId: 'kb-policy-shipping-payment',
    category: 'policy',
    title: 'Chính sách Giao hàng, Phí vận chuyển & Thanh toán',
    text: `Chính sách giao hàng và thanh toán tại MỘC Coffee:
- Phạm vi giao hàng: Giao tận nơi trên toàn quốc (63 tỉnh thành).
- Thời gian xử lý đơn: Xác nhận, rang xay mới và đóng gói trong vòng 24 giờ làm việc.
- Thời gian giao hàng dự kiến: Nội thành TP.HCM, Hà Nội & Đắk Lắk từ 1 – 2 ngày làm việc; các tỉnh thành khác từ 2 – 4 ngày làm việc.
- Phí vận chuyển tiêu chuẩn: Đồng giá 30.000₫/đơn toàn quốc. Miễn phí vận chuyển (0₫) cho đơn hàng từ 500.000₫ trở lên.
- Phương thức thanh toán: Hỗ trợ COD (Thanh toán tiền mặt khi nhận hàng, được đồng kiểm) và BANK_TRANSFER (Chuyển khoản ngân hàng theo mã đơn MOC-...).`,
  },
  {
    docId: 'kb-policy-return-privacy',
    category: 'policy',
    title: 'Chính sách Đổi trả, Hủy đơn & Bảo mật thông tin',
    text: `Chính sách đổi trả, hoàn tiền và bảo mật tại MỘC Coffee:
- Đổi trả trong 7 ngày: Đổi mới 100% miễn phí vận chuyển nếu sản phẩm bị rách bao bì, hở van 1 chiều hoặc giao sai loại hạt, sai khối lượng, sai cỡ xay. Khách chỉ cần liên hệ Hotline 1900 6868 kèm mã đơn (MOC-...) và ảnh thực tế.
- Hủy đơn hàng: Khách tự hủy trực tuyến tại mục "Tài khoản -> Đơn hàng của tôi" khi đơn ở trạng thái "Chờ xác nhận" (pending), hệ thống tự động hoàn kho ngay lập tức.
- Bảo mật thông tin: Dữ liệu lưu trữ an toàn trên Cloudflare D1, số điện thoại được che bảo mật (090****567) khi tra cứu công khai, tuyệt đối không chia sẻ cho bên thứ ba ngoài đơn vị vận chuyển.`,
  },
  {
    docId: 'kb-brewing-phin',
    category: 'brewing',
    title: 'Hướng dẫn công thức pha Cà phê Phin truyền thống sánh đậm',
    text: `Bí quyết pha Phin Việt Nam sánh đậm, hậu ngọt chuẩn Barista MỘC Coffee:
1. Chọn hạt & cỡ xay: Dùng Robusta Buôn Ma Thuột hoặc Blend Phin Việt, chọn cỡ "Xay pha Phin truyền thống" (độ mịn vừa như hạt muối tinh).
2. Tráng nóng phin: Tráng phin nhôm bằng nước sôi để ổn định nhiệt độ.
3. Định lượng: Cho 25g cà phê (khoảng 1/2 phin), lắc nhẹ cho phẳng mặt rồi đặt nắp gài vừa tay (không nén quá chặt).
4. Ủ cà phê (Blooming - quan trọng nhất): Châm 20ml – 30ml nước sôi (92°C – 96°C) đều khắp bề mặt, ủ trong 1 – 2 phút cho bột cà phê nở đều.
5. Chiết xuất: Châm tiếp 50ml – 60ml nước sôi theo vòng tròn từ tâm ra ngoài, đậy nắp chờ từng giọt cà phê nhỏ xuống. Thêm đá hoặc 20ml sữa đặc.`,
    productSlug: 'blend-phin-viet',
  },
  {
    docId: 'kb-brewing-v60-coldbrew',
    category: 'brewing',
    title: 'Hướng dẫn pha Pour Over V60, Cold Brew & Pha máy Espresso',
    text: `Công thức pha hiện đại tại MỘC Coffee:
- Pha Pour Over / V60: Dùng hạt Arabica Cầu Đất hoặc Arabica Sơn La Bourbon (xay vừa). Tỷ lệ vàng 1:15 (20g cà phê + 300ml nước nóng 90°C – 92°C). Rót 40ml nước ủ Blooming trong 35 giây, sau đó rót xoắn ốc 2 đợt đến 180ml và 300ml trong tổng thời gian 2 phút 15 giây – 2 phút 30 giây.
- Ủ lạnh Cold Brew: Dùng Cold Brew Signature Blend hoặc Arabica Cầu Đất (xay thô). Tỷ lệ 1:10 (50g cà phê + 500ml nước lọc mát), khuấy nhẹ, đậy kín và ủ trong ngăn mát tủ lạnh 16 – 20 tiếng rồi lọc bã.
- Pha máy Espresso: Dùng Espresso House Blend, định lượng 18g – 20g bột mịn, chiết xuất ở áp suất 9 bar, nhiệt độ 92°C trong 25 – 30 giây thu được 36g – 40g espresso với lớp crema màu hạt dẻ dày mịn.`,
    productSlug: 'arabica-cau-dat',
  },
  {
    docId: 'kb-storage-preservation',
    category: 'brewing',
    title: 'Mẹo bảo quản cà phê rang mộc giữ trọn hương thơm',
    text: `Cách bảo quản cà phê rang mộc MỘC Coffee đúng chuẩn:
- Luôn kéo kín khóa Zip ngay sau khi lấy cà phê và bóp nhẹ thân túi để đẩy không khí thừa thoát ra ngoài qua Van 1 chiều.
- Để túi cà phê ở nơi khô ráo, thoáng mát (20°C – 28°C), tránh ánh nắng trực tiếp và nguồn nhiệt.
- TUYỆT ĐỐI KHÔNG bảo quản cà phê trong tủ lạnh vì độ ẩm cao làm ngưng tụ nước và khiến cà phê hút mùi thực phẩm.
- Thời hạn thưởng thức ngon nhất: Trong vòng 30 – 45 ngày kể từ khi mở túi (hoặc 6 tháng từ ngày rang).`,
  },
  {
    docId: 'kb-faq-sommelier',
    category: 'faq',
    title: 'Câu hỏi thường gặp: Sợ say cà phê, Gu sữa đá đậm đà & Cách nhận biết cà phê mộc',
    text: `Giải đáp thắc mắc thường gặp của khách hàng MỘC Coffee:
- Hay bị say cà phê, tim đập nhanh nên chọn loại nào? Hãy chọn 100% Arabica như "Arabica Cầu Đất" (189.000₫) hoặc "Arabica Sơn La Bourbon" (199.000₫) vì hàm lượng caffeine chỉ bằng phân nửa Robusta, vị chua thanh dịu và hậu ngọt mật ong rất êm dịu.
- Thích uống cà phê sữa đá Sài Gòn đậm đà, sánh quyện, không chua? Hãy chọn "Robusta Buôn Ma Thuột" (129.000₫ - vị sô-cô-la đen mạnh mẽ) hoặc "Blend Phin Việt" (165.000₫ - phối trộn 70% Robusta / 30% Arabica thơm hương caramel).
- Nhận biết cà phê rang mộc thật: Bột màu nâu cánh gián tự nhiên (không đen kịt bết dầu bơ), nước pha màu nâu hổ phách trong trẻo, lớp bọt nâu sáng mịn tự tan nhanh.`,
  },
];

// ----------------------------------------------------------------------------
// 2. BƯỚC 1 TRONG PIPELINE: CHUNKING (CHIA NHỎ VĂN BẢN CÓ OVERLAP NGỮ NGHĨA)
// ----------------------------------------------------------------------------
export function splitTextIntoSemanticChunks(
  text: string,
  maxChars = 420,
  overlapChars = 60
): string[] {
  const cleanText = text.replace(/\r\n/g, '\n').trim();
  if (cleanText.length <= maxChars) {
    return [cleanText];
  }

  const paragraphs = cleanText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (!current) {
      current = para;
    } else if (current.length + 1 + para.length <= maxChars) {
      current += '\n' + para;
    } else {
      chunks.push(current);
      // Giữ lại phần đuôi (overlap) của đoạn trước để bảo toàn mạch ngữ nghĩa
      const tail =
        overlapChars > 0 && current.length > overlapChars
          ? current.slice(-overlapChars).replace(/^\S+\s/, '')
          : '';
      current = tail ? `${tail}\n${para}` : para;
    }
  }

  if (current) {
    chunks.push(current);
  }
  return chunks;
}

export function buildKnowledgeChunks(products: Product[]): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];

  // 2.1. Chunking từ tài liệu Knowledge Base (Chính sách, Quyền lợi, Lợi thế, Pha chế, FAQ)
  for (const doc of STATIC_KNOWLEDGE_DOCUMENTS) {
    const pieces = splitTextIntoSemanticChunks(doc.text, 450, 50);
    pieces.forEach((piece, idx) => {
      chunks.push({
        chunk_key: `${doc.docId}-p${idx + 1}`,
        category: doc.category,
        title: doc.title,
        content: `[${doc.title}]\n${piece}`,
        product_slug: doc.productSlug || null,
      });
    });
  }

  // 2.2. Chunking tự động từ Danh mục Sản phẩm thực tế trong D1 Database
  for (const p of products) {
    const finalPrice = p.sale_price ?? p.price;
    const priceInfo =
      p.sale_price && p.sale_price < p.price
        ? `${formatVND(p.sale_price)} (Giá gốc: ${formatVND(p.price)})`
        : formatVND(p.price);

    const productDoc = `Sản phẩm: ${p.name} (Mã SKU: ${p.sku}, Slug: ${p.slug}).
Vùng nguyên liệu: ${p.origin}. Khối lượng: Gói ${p.weight_grams}g.
Giá bán hiện tại: ${priceInfo}. Tình trạng kho: ${p.stock > 0 ? `Còn ${p.stock} gói` : 'Tạm hết hàng'}.
Mức rang: ${p.roast_level}. Phương pháp sơ chế: ${p.process_method}.
Hương vị đặc trưng (Tasting notes): ${p.tasting_notes}.
Mô tả chi tiết: ${p.short_description} ${p.description}`;

    const pieces = splitTextIntoSemanticChunks(productDoc, 520, 60);
    pieces.forEach((piece, idx) => {
      chunks.push({
        chunk_key: `prod-${p.slug}-p${idx + 1}`,
        category: 'product',
        title: `Sản phẩm ${p.name} (${formatVND(finalPrice)})`,
        content: piece,
        product_slug: p.slug,
      });
    });
  }

  return chunks;
}

// ----------------------------------------------------------------------------
// 3. BƯỚC 2 TRONG PIPELINE: WORD EMBEDDING
// Ưu tiên gọi Cloudflare Workers AI (@cf/baai/bge-m3).
// Có bộ tạo Vector ngữ nghĩa dự phòng (Deterministic Semantic Feature Hash Embedding)
// khi chạy ở môi trường Local / Test chưa kết nối Internet tới Cloudflare AI.
// ----------------------------------------------------------------------------
const VIETNAMESE_FEATURE_GROUPS: string[][] = [
  ['đậm', 'mạnh', 'phin', 'sữa đá', 'đen đá', 'robusta', 'buôn ma thuột', 'đắk lắk', 'tỉnh táo', 'không chua', 'sô-cô-la'],
  ['chua thanh', 'thơm', 'hoa quả', 'trái cây', 'arabica', 'cầu đất', 'đà lạt', 'sơn la', 'ít cafein', 'say cà phê', 'nhẹ nhàng', 'mật ong'],
  ['pha máy', 'espresso', 'latte', 'cappuccino', 'americano', 'crema', 'hạt phỉ', 'cacao', 'văn phòng'],
  ['cold brew', 'ủ lạnh', 'v60', 'pour over', 'giấy lọc', 'chemex', 'french press', 'cam vàng', 'mơ chín'],
  ['quà tặng', 'hộp quà', 'biếu', 'đối tác', 'lễ tết', 'set quà', 'tinh hoa'],
  ['cách pha', 'hướng dẫn', 'công thức', 'tỷ lệ', 'nhiệt độ', 'blooming', 'chiết xuất'],
  ['bảo quản', 'giữ hương', 'tủ lạnh', 'khóa zip', 'van 1 chiều', 'hạn sử dụng'],
  ['giao hàng', 'vận chuyển', 'phí ship', 'freeship', 'miễn phí', 'bao lâu', 'cod', 'thanh toán', 'chuyển khoản'],
  ['đổi trả', 'hoàn tiền', 'rách', 'hở van', 'hủy đơn', 'bảo mật', 'quyền lợi', 'đồng kiểm'],
  ['lợi thế', 'rang mộc', 'nguyên chất', 'không tẩm', 'bơ', 'hóa chất', 'nguồn gốc', 'nông trại', 'liên hệ', 'hotline', 'địa chỉ'],
];

function computeFallbackEmbedding(text: string, dims = 64): number[] {
  const vec = new Array<number>(dims).fill(0);
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Nạp tín hiệu ngữ nghĩa theo nhóm chủ đề tiếng Việt vào 20 chiều đầu
  VIETNAMESE_FEATURE_GROUPS.forEach((group, gIdx) => {
    for (const kw of group) {
      if (normalized.includes(kw)) {
        vec[gIdx * 2] += 2.5;
        vec[gIdx * 2 + 1] += 1.8;
      }
    }
  });

  // 2. Nạp tín hiệu từ vựng (Unigrams & Bigrams hashing) vào các chiều còn lại
  const tokens = normalized.split(' ').filter((t) => t.length > 1);
  for (let i = 0; i < tokens.length; i++) {
    const uni = tokens[i];
    let h1 = 2166136261;
    for (let c = 0; c < uni.length; c++) {
      h1 ^= uni.charCodeAt(c);
      h1 = Math.imul(h1, 16777619);
    }
    const idx1 = 20 + (Math.abs(h1) % (dims - 20));
    vec[idx1] += 1.0;

    if (i < tokens.length - 1) {
      const bi = `${tokens[i]}_${tokens[i + 1]}`;
      let h2 = 2166136261;
      for (let c = 0; c < bi.length; c++) {
        h2 ^= bi.charCodeAt(c);
        h2 = Math.imul(h2, 16777619);
      }
      const idx2 = 20 + (Math.abs(h2) % (dims - 20));
      vec[idx2] += 1.5;
    }
  }

  // Chuẩn hóa L2 (Unit Vector)
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => Number((v / norm).toFixed(5)));
}

export async function generateEmbeddings(
  env: WorkerEnv,
  texts: string[]
): Promise<{ vectors: number[][]; modelUsed: string }> {
  const modelName = env.CF_EMBEDDING_MODEL || DEFAULT_CF_EMBEDDING_MODEL;

  // Nếu có binding Cloudflare Workers AI (c.env.AI), gọi trực tiếp model @cf/baai/bge-m3
  if (env.AI && typeof env.AI.run === 'function') {
    try {
      const aiRes = await env.AI.run(modelName, { text: texts });
      const data: number[][] | undefined = aiRes?.data;
      if (Array.isArray(data) && data.length === texts.length && Array.isArray(data[0])) {
        return { vectors: data, modelUsed: modelName };
      }
    } catch (err) {
      console.warn('[RAG Embedding] Cloudflare AI fallback activated:', (err as Error)?.message);
    }
  }

  // Fallback embedding khi chạy local dev / unit test không có kết nối Workers AI
  return {
    vectors: texts.map((t) => computeFallbackEmbedding(t, 64)),
    modelUsed: `${modelName} (local-hybrid-vector)`,
  };
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const len = Math.min(vecA.length, vecB.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ----------------------------------------------------------------------------
// 4. BƯỚC 3 TRONG PIPELINE: VECTOR DATABASE INDEXING & SEARCH
// Lưu trữ Vector vào bảng `rag_chunks` trong Cloudflare D1 VÀ đồng bộ lên
// Cloudflare Vectorize (`env.VECTORIZE`) nếu đã gắn binding.
// ----------------------------------------------------------------------------
export async function indexKnowledgeBaseToVectorDB(
  env: WorkerEnv,
  products: Product[],
  forceReindex = false
): Promise<{ totalChunks: number; embeddingModel: string; vectorBackend: 'cloudflare_vectorize' | 'd1_vector_store' }> {
  // Kiểm tra xem D1 đã có dữ liệu Vector chưa
  if (!forceReindex) {
    const existingCount = await env.DB.prepare('SELECT COUNT(*) as count FROM rag_chunks')
      .first<{ count: number }>()
      .catch(() => null);
    if (existingCount && existingCount.count >= 15) {
      return {
        totalChunks: existingCount.count,
        embeddingModel: env.CF_EMBEDDING_MODEL || DEFAULT_CF_EMBEDDING_MODEL,
        vectorBackend: env.VECTORIZE ? 'cloudflare_vectorize' : 'd1_vector_store',
      };
    }
  }

  // 1. Thực hiện Chunking
  const chunks = buildKnowledgeChunks(products);

  // 2. Thực hiện Word Embedding cho toàn bộ các Chunks
  const textsToEmbed = chunks.map((c) => `${c.title}\n${c.content}`);
  const { vectors, modelUsed } = await generateEmbeddings(env, textsToEmbed);

  // 3. Lưu vào Vector DB trên Cloudflare D1 (`rag_chunks`)
  await env.DB.prepare('DELETE FROM rag_chunks').run().catch(() => {});

  const insertStatements = chunks.map((chunk, idx) => {
    const vec = vectors[idx] || [];
    return env.DB.prepare(
      `INSERT OR REPLACE INTO rag_chunks (
        chunk_key, category, title, content, product_slug, embedding_model, embedding_dim, embedding_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      chunk.chunk_key,
      chunk.category,
      chunk.title,
      chunk.content,
      chunk.product_slug || null,
      modelUsed,
      vec.length,
      JSON.stringify(vec)
    );
  });

  await env.DB.batch(insertStatements);

  // 4. Nếu có gắn Cloudflare Vectorize Index (env.VECTORIZE), upsert song song lên Vectorize
  if (env.VECTORIZE && typeof env.VECTORIZE.upsert === 'function') {
    try {
      const vectorizeRecords = chunks.map((chunk, idx) => ({
        id: chunk.chunk_key,
        values: vectors[idx],
        metadata: {
          category: chunk.category,
          title: chunk.title,
          content: chunk.content,
          product_slug: chunk.product_slug || '',
        },
      }));
      await env.VECTORIZE.upsert(vectorizeRecords);
    } catch (err) {
      console.warn('[RAG Vectorize] Upsert warning:', (err as Error)?.message);
    }
  }

  return {
    totalChunks: chunks.length,
    embeddingModel: modelUsed,
    vectorBackend: env.VECTORIZE ? 'cloudflare_vectorize' : 'd1_vector_store',
  };
}

export async function searchVectorDB(
  env: WorkerEnv,
  query: string,
  products: Product[],
  topK = 4
): Promise<{
  topChunks: RagRetrievedChunk[];
  totalChunksIndexed: number;
  embeddingModel: string;
  vectorBackend: 'cloudflare_vectorize' | 'd1_vector_store';
}> {
  // Đảm bảo Vector DB đã được index
  const indexInfo = await indexKnowledgeBaseToVectorDB(env, products, false);

  // Nhúng câu hỏi của khách hàng thành Query Vector
  const { vectors, modelUsed } = await generateEmbeddings(env, [query]);
  const queryVector = vectors[0] || [];

  // Nhánh A: Nếu có Cloudflare Vectorize Index và vector cùng chiều (1024)
  if (env.VECTORIZE && typeof env.VECTORIZE.query === 'function' && queryVector.length >= 256) {
    try {
      const vRes = await env.VECTORIZE.query(queryVector, {
        topK,
        returnMetadata: 'all',
      });
      if (vRes?.matches?.length) {
        const topChunks: RagRetrievedChunk[] = vRes.matches.map((m: any) => ({
          chunk_key: m.id,
          category: m.metadata?.category || 'general',
          title: m.metadata?.title || '',
          content: m.metadata?.content || '',
          score: Number((m.score || 0).toFixed(4)),
          product_slug: m.metadata?.product_slug || null,
        }));
        return {
          topChunks,
          totalChunksIndexed: indexInfo.totalChunks,
          embeddingModel: modelUsed,
          vectorBackend: 'cloudflare_vectorize',
        };
      }
    } catch {
      // Fallback sang D1 Vector Store nếu Vectorize lỗi
    }
  }

  // Nhánh B: Truy vấn từ bảng `rag_chunks` trong D1 Vector Store và xếp hạng bằng Cosine Similarity + Keyword Boost
  const { results: storedRows } = await env.DB.prepare('SELECT * FROM rag_chunks').all<{
    chunk_key: string;
    category: string;
    title: string;
    content: string;
    product_slug: string | null;
    embedding_json: string;
  }>();

  const qLower = query.toLowerCase().trim();
  const qWords = qLower.split(/\s+/).filter((w) => w.length >= 2);

  const scored: RagRetrievedChunk[] = storedRows.map((row) => {
    let chunkVec: number[] = [];
    try {
      chunkVec = JSON.parse(row.embedding_json || '[]');
    } catch {
      chunkVec = [];
    }

    // Nếu số chiều khớp nhau thì dùng trực tiếp vector đã lưu; nếu lệch chiều thì tính lại
    const targetVec =
      chunkVec.length === queryVector.length
        ? chunkVec
        : computeFallbackEmbedding(`${row.title}\n${row.content}`, queryVector.length || 64);

    let cosine = cosineSimilarity(queryVector, targetVec);

    // Hybrid Lexical Boost (kết hợp điểm từ khóa chính xác để tăng độ nhạy cho tên riêng tiếng Việt)
    const haystack = `${row.title} ${row.content}`.toLowerCase();
    let keywordBonus = 0;
    for (const w of qWords) {
      if (haystack.includes(w)) keywordBonus += 0.04;
    }
    const finalScore = Math.min(0.9999, Math.max(0, cosine + Math.min(0.22, keywordBonus)));

    return {
      chunk_key: row.chunk_key,
      category: row.category,
      title: row.title,
      content: row.content,
      score: Number(finalScore.toFixed(4)),
      product_slug: row.product_slug,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    topChunks: scored.slice(0, topK),
    totalChunksIndexed: storedRows.length,
    embeddingModel: modelUsed,
    vectorBackend: 'd1_vector_store',
  };
}

// ----------------------------------------------------------------------------
// 5. BƯỚC 4 TRONG PIPELINE: GỌI MÔ HÌNH NGÔN NGỮ LỚN (LLM GENERATION)
// Ưu tiên 1: Cloudflare Workers AI (c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast'))
// Ưu tiên 2: Google Gemini 2.5 Flash API (nếu có GEMINI_API_KEY)
// ----------------------------------------------------------------------------
export async function generateRagLLMResponse(
  env: WorkerEnv,
  userMessage: string,
  history: ChatHistoryItem[],
  topChunks: RagRetrievedChunk[],
  shippingFee: number,
  freeThreshold: number,
  customerName?: string
): Promise<{ reply: string | null; llmModelUsed: string }> {
  const cfLlmModel = env.CF_LLM_MODEL || DEFAULT_CF_LLM_MODEL;

  const retrievedContextText = topChunks
    .map(
      (chunk, idx) =>
        `--- [Tài liệu tham khảo #${idx + 1} | Chủ đề: ${chunk.category} | Độ khớp: ${chunk.score}] ---\n${chunk.content}`
    )
    .join('\n\n');

  const systemPrompt = `Bạn là Trợ lý Barista AI chính thức của thương hiệu cà phê đặc sản Việt Nam "MỘC Coffee — Hương Vị Việt. Đánh Thức Đam Mê.".
${customerName ? `Khách hàng đang trò chuyện tên là: ${customerName}.` : ''}

NHIỆM VỤ & QUY TẮC BẮT BUỘC:
1. Chỉ sử dụng thông tin trong phần [NGỮ CẢNH TRI THỨC TỪ VECTOR DB] bên dưới để trả lời chính xác về sản phẩm, giá bán, tồn kho, lợi thế, quyền lợi, chính sách giao hàng/đổi trả và công thức pha chế của MỘC Coffee.
2. Trả lời bằng tiếng Việt ấm áp, lịch sự, chuyên nghiệp, ngắn gọn dễ đọc (sử dụng gạch đầu dòng • và in đậm **từ khóa quan trọng**).
3. Luôn nêu rõ mức giá chính xác bằng VNĐ và nhắc khách hàng có thể chọn "Nguyên hạt" hoặc "Xay miễn phí theo dụng cụ pha (Phin, Máy Espresso, V60, Cold Brew)".
4. Phí vận chuyển hiện tại là ${formatVND(shippingFee)}, miễn phí vận chuyển (Freeship) toàn quốc cho đơn từ ${formatVND(freeThreshold)}.

[NGỮ CẢNH TRI THỨC TỪ VECTOR DB]:
${retrievedContextText}`;

  // 1. Thử gọi trực tiếp model trên Cloudflare Workers AI (https://dash.cloudflare.com/.../ai/models)
  if (env.AI && typeof env.AI.run === 'function') {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map((h) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content,
        })),
        { role: 'user', content: userMessage },
      ];

      const aiResult = await env.AI.run(cfLlmModel, {
        messages,
        max_tokens: 650,
        temperature: 0.25,
      });

      const responseText =
        typeof aiResult?.response === 'string'
          ? aiResult.response.trim()
          : aiResult?.choices?.[0]?.message?.content?.trim();

      if (responseText) {
        return {
          reply: responseText,
          llmModelUsed: cfLlmModel,
        };
      }
    } catch (err) {
      console.warn('[RAG LLM] Cloudflare Workers AI warning:', (err as Error)?.message);
    }
  }

  // 2. Dự phòng gọi Google Gemini 2.5 Flash nếu người dùng cấu hình GEMINI_API_KEY
  const geminiKey = env.GEMINI_API_KEY;
  if (geminiKey && typeof geminiKey === 'string' && geminiKey.trim().length > 10) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              ...history.slice(-6).map((h) => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }],
              })),
              { role: 'user', parts: [{ text: userMessage }] },
            ],
          }),
        }
      );

      if (geminiRes.ok) {
        const geminiJson = (await geminiRes.json()) as any;
        const aiText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          return {
            reply: aiText.trim(),
            llmModelUsed: 'gemini-2.5-flash',
          };
        }
      }
    } catch {
      // Fallback sang bộ tổng hợp ngữ cảnh RAG nội bộ
    }
  }

  return {
    reply: null,
    llmModelUsed: `${cfLlmModel} (rag-synthesizer)`,
  };
}
