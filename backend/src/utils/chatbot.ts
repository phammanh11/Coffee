import type { Context } from 'hono';
import type { WorkerEnv } from '../db/init';
import type {
  ChatHistoryItem,
  ChatResponseData,
  CustomerUser,
  Order,
  Product,
} from '../../shared/types';
import { formatVND, ORDER_STATUS_LABELS } from '../../shared/constants';
import { getAuthenticatedCustomer } from '../middleware/auth';

function normalizeVi(text: string): string {
  return text.toLowerCase().trim();
}

export async function handleBaristaChat(
  c: Context<{ Bindings: WorkerEnv; Variables: any }>,
  rawMessage: string,
  history: ChatHistoryItem[] = []
): Promise<ChatResponseData> {
  const message = rawMessage.trim();
  const q = normalizeVi(message);

  // 1. Lấy danh sách sản phẩm thực tế từ D1 Database
  const { results: products } = await c.env.DB.prepare(
    'SELECT * FROM products WHERE is_active = 1 ORDER BY is_featured DESC, rating_avg DESC'
  ).all<Product>();

  // Lấy thông tin khách hàng đang đăng nhập (nếu có)
  const customer: CustomerUser | null = await getAuthenticatedCustomer(c);

  const shippingFee = Number(c.env.DEFAULT_SHIPPING_FEE || 30000);
  const freeThreshold = Number(c.env.FREE_SHIPPING_THRESHOLD || 500000);

  // 2. Kiểm tra xem tin nhắn có chứa Mã đơn hàng (MOC-...) hoặc Số điện thoại (09xxxxxxxx) hoặc hỏi về đơn hàng không
  const orderCodeMatch = message.toUpperCase().match(/MOC-[A-Z0-9]{4,10}-[A-Z0-9]{3,6}/);
  const phoneMatch = message.replace(/[\s.-]/g, '').match(/(0[35789][0-9]{8})/);
  const isAskingOrder =
    orderCodeMatch !== null ||
    phoneMatch !== null ||
    /(đơn hàng|kiểm tra đơn|tra cứu đơn|đơn của tôi|đơn mình|tình trạng đơn|bao giờ giao|giao tới đâu)/i.test(
      q
    );

  if (isAskingOrder) {
    const matchedOrders: Order[] = [];

    if (orderCodeMatch) {
      const code = orderCodeMatch[0];
      const ord = await c.env.DB.prepare('SELECT * FROM orders WHERE order_code = ?')
        .bind(code)
        .first<Order>();
      if (ord) {
        const { results: items } = await c.env.DB.prepare(
          'SELECT * FROM order_items WHERE order_id = ?'
        )
          .bind(ord.id)
          .all<any>();
        matchedOrders.push({ ...ord, items });
      }
    } else if (phoneMatch) {
      const phone = phoneMatch[1];
      const { results: ords } = await c.env.DB.prepare(
        'SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 5'
      )
        .bind(phone)
        .all<Order>();
      for (const ord of ords) {
        const { results: items } = await c.env.DB.prepare(
          'SELECT * FROM order_items WHERE order_id = ?'
        )
          .bind(ord.id)
          .all<any>();
        matchedOrders.push({ ...ord, items });
      }
    } else if (customer) {
      const { results: ords } = await c.env.DB.prepare(
        `SELECT * FROM orders
         WHERE user_id = ? OR customer_phone = ? OR LOWER(customer_email) = ?
         ORDER BY created_at DESC LIMIT 5`
      )
        .bind(customer.id, customer.phone || '', customer.email.toLowerCase())
        .all<Order>();
      for (const ord of ords) {
        const { results: items } = await c.env.DB.prepare(
          'SELECT * FROM order_items WHERE order_id = ?'
        )
          .bind(ord.id)
          .all<any>();
        matchedOrders.push({ ...ord, items });
      }
    }

    if (matchedOrders.length > 0) {
      const latest = matchedOrders[0];
      const statusLabel = ORDER_STATUS_LABELS[latest.status] || latest.status;
      const reply =
        matchedOrders.length === 1
          ? `Mình tìm thấy đơn hàng **#${latest.order_code}** của **${latest.customer_name}** rồi ạ!\n\n• **Trạng thái hiện tại:** ${statusLabel}\n• **Tổng thanh toán:** ${formatVND(latest.total)} (${latest.payment_method})\n• **Địa chỉ nhận:** ${latest.shipping_address}, ${latest.ward}, ${latest.district}, ${latest.province}\n\nBạn có thể nhấn vào thẻ đơn hàng bên dưới để xem chi tiết từng sản phẩm nhé!`
          : `Mình tìm thấy **${matchedOrders.length} đơn hàng** gần nhất của bạn. Đơn mới nhất **#${latest.order_code}** hiện đang ở trạng thái **${statusLabel}** (${formatVND(latest.total)}). Mời bạn xem danh sách chi tiết ngay bên dưới nhé:`;

      return {
        reply,
        intent: 'order_lookup',
        matchedOrders,
        suggestions: [
          '☕ Tư vấn thêm cà phê ngon',
          '🚚 Chính sách giao hàng',
          '📖 Hướng dẫn pha Phin chuẩn vị',
        ],
      };
    }

    // Nếu hỏi về đơn hàng nhưng chưa cung cấp mã hoặc SĐT (hoặc không tìm thấy)
    if (orderCodeMatch || phoneMatch) {
      return {
        reply: `Mình chưa tìm thấy đơn hàng nào khớp với thông tin **${orderCodeMatch?.[0] || phoneMatch?.[1]}** trên hệ thống. Bạn vui lòng kiểm tra lại **Số điện thoại đặt hàng** hoặc **Mã đơn (MOC-...)** giúp mình nhé!`,
        intent: 'order_lookup',
        suggestions: [
          '📦 Tra cứu bằng SĐT 0901234567',
          '☕ Tư vấn chọn cà phê hợp gu',
          '📞 Thông tin liên hệ MỘC Coffee',
        ],
      };
    }

    return {
      reply:
        'Để mình kiểm tra trạng thái đơn hàng giúp bạn ngay nhé! Bạn chỉ cần nhắn trực tiếp **Số điện thoại đặt hàng** (ví dụ: `0901234567`) hoặc **Mã đơn hàng** (ví dụ: `MOC-261019-1234`) vào khung chat này, hoặc đăng nhập vào mục **Tài khoản** ở góc trên nhé.',
      intent: 'order_lookup',
      suggestions: [
        '0901234567',
        '☕ Tư vấn chọn cà phê hợp gu',
        '🚚 Phí vận chuyển tính thế nào?',
      ],
    };
  }

  // 3. Kiểm tra câu hỏi về Hướng dẫn pha chế / Bảo quản (chỉ khi người dùng hỏi cách pha / công thức / bảo quản)
  if (
    !/(tư vấn|chọn|gợi ý|mua|loại nào)/i.test(q) &&
    /(cách pha|hướng dẫn|công thức|tỷ lệ pha|nhiệt độ nước|cách ủ|bảo quản|giữ hương)/i.test(q)
  ) {
    if (/(cold brew|ủ lạnh)/i.test(q)) {
      const arabica = products.find((p) => p.slug.includes('arabica')) || products[0];
      return {
        reply:
          '✨ **Công thức ủ Cold Brew thanh mát chuẩn Barista MỘC Coffee:**\n\n1. **Chọn hạt & Cỡ xay:** Dùng hạt **Arabica Cầu Đất** xay thô (cỡ hạt đường kính lớn).\n2. **Tỷ lệ vàng 1:10:** 50g cà phê + 500ml nước lọc mát.\n3. **Thời gian ủ:** Khuấy nhẹ cho thấm đều, đậy kín và ủ trong ngăn mát tủ lạnh **16 – 20 tiếng**.\n4. **Thưởng thức:** Lọc qua giấy lọc, thêm đá hoặc một lát cam vàng / mật ong rừng cực kỳ cuốn!',
        intent: 'brewing_guide',
        recommendedProducts: arabica ? [arabica] : [],
        suggestions: [
          '🫖 Hướng dẫn pha Phin truyền thống',
          '☕ Tư vấn hạt Arabica Cầu Đất',
          '📦 Bảo quản cà phê thế nào?',
        ],
      };
    }

    if (/(v60|pour over|giấy lọc)/i.test(q)) {
      const arabica = products.find((p) => p.slug.includes('arabica')) || products[0];
      return {
        reply:
          '🌸 **Công thức pha Pour Over / V60 tôn hương hoa quả:**\n\n1. **Tỷ lệ 1:15:** 20g cà phê **Arabica Cầu Đất** (xay vừa) + 300ml nước nóng **90°C – 92°C**.\n2. **Blooming (Ủ nở):** Rót 40ml nước đầu tiên, chờ **35 giây** để cà phê thoát khí CO2 tươi.\n3. **Chiết xuất:** Rót xoắn ốc nhẹ nhàng 2 đợt (đến 180ml và 300ml) trong tổng thời gian **2 phút 15 giây – 2 phút 30 giây**.',
        intent: 'brewing_guide',
        recommendedProducts: arabica ? [arabica] : [],
        suggestions: [
          '🫖 Cách pha Phin đậm đà',
          '🧊 Cách ủ Cold Brew tại nhà',
          '☕ Xem các dòng cà phê đặc sản',
        ],
      };
    }

    if (/(bảo quản|giữ hương|hạn sử dụng)/i.test(q)) {
      return {
        reply:
          '🛡️ **Mẹo bảo quản cà phê rang mộc giữ trọn hương thơm:**\n\n• Luôn kéo kín khóa Zip sau khi lấy cà phê và bóp nhẹ để đẩy không khí thừa qua **van 1 chiều** trên túi MỘC Coffee.\n• Để nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và **không bảo quản trong tủ lạnh** (vì cà phê dễ hút ẩm và mùi thực phẩm).\n• Ngon nhất trong vòng **30 – 45 ngày** kể từ khi mở túi (hoặc 6 tháng từ ngày rang).',
        intent: 'brewing_guide',
        suggestions: [
          '🫖 Hướng dẫn pha Phin chuẩn vị',
          '☕ Tư vấn cà phê hợp gu của mình',
          '🚚 Chính sách giao hàng',
        ],
      };
    }

    // Mặc định hướng dẫn pha Phin Việt Nam
    const phinProducts = products.filter(
      (p) => p.slug.includes('phin') || p.slug.includes('robusta')
    );
    return {
      reply:
        '🫖 **Bí quyết pha Phin Việt Nam sánh đậm, hậu ngọt:**\n\n1. **Tráng phin:** Tráng phin nhôm bằng nước sôi để làm nóng đều.\n2. **Định lượng:** Cho **25g cà phê** (khoảng 1/2 phin), lắc nhẹ cho phẳng mặt rồi đặt nắp gài vừa tay (không nén quá chặt).\n3. **Ủ cà phê (quan trọng nhất):** Châm **30ml nước sôi (94°C – 96°C)** vào ủ trong **1 – 2 phút** cho bột cà phê nở đều.\n4. **Chiết xuất:** Châm tiếp **50ml – 60ml nước sôi**, đậy nắp chờ từng giọt cà phê sánh đậm nhỏ xuống. Thêm đá hoặc 20ml sữa đặc là chuẩn vị!',
      intent: 'brewing_guide',
      recommendedProducts: phinProducts.slice(0, 2),
      suggestions: [
        '🧊 Cách ủ Cold Brew thanh mát',
        '🌸 Cách pha V60 / Pour Over',
        '📦 Kiểm tra đơn hàng của tôi',
      ],
    };
  }

  // 4. Kiểm tra câu hỏi về Giao hàng / Thanh toán / Đổi trả / Khuyến mãi
  if (
    /(phí ship|giao hàng|vận chuyển|freeship|miễn phí ship|bao lâu nhận|thanh toán|chuyển khoản|cod|đổi trả)/i.test(
      q
    )
  ) {
    return {
      reply: `🚚 **Chính sách Giao hàng & Thanh toán tại MỘC Coffee:**\n\n• **Phí vận chuyển:** Đồng giá **${formatVND(shippingFee)}** toàn quốc. Đặc biệt **Miễn phí vận chuyển (Freeship)** cho mọi đơn hàng từ **${formatVND(freeThreshold)}** trở lên!\n• **Thời gian giao hàng:** Nội thành TP.HCM & Hà Nội từ **1 – 2 ngày**; các tỉnh thành khác từ **2 – 4 ngày làm việc**.\n• **Hình thức thanh toán:** Hỗ trợ **COD (Thanh toán khi nhận hàng - được đồng kiểm)** và **Chuyển khoản ngân hàng**.\n• **Cam kết chất lượng:** Đổi mới 100% miễn phí trong 7 ngày nếu bao bì rách hở van hoặc gửi nhầm hình thức xay.`,
      intent: 'shipping_policy',
      suggestions: [
        '☕ Tư vấn chọn cà phê hợp gu',
        '📦 Kiểm tra đơn hàng của tôi',
        '🫖 Hướng dẫn pha Phin ngon',
      ],
    };
  }

  // 5. Kiểm tra câu hỏi về Câu chuyện thương hiệu / Nguồn gốc / Liên hệ
  if (
    /(nguồn gốc|nông trại|vùng trồng|câu chuyện|mộc coffee là|địa chỉ|hotline|liên hệ|số điện thoại shop|ở đâu)/i.test(
      q
    )
  ) {
    return {
      reply:
        '🌱 **Về MỘC Coffee — Hương Vị Việt. Đánh Thức Đam Mê:**\n\n• **100% Rang Mộc Nguyên Bản:** Không tẩm bơ, không hương liệu hóa học, không chất độn.\n• **Vùng nguyên liệu tuyển chọn:** Hạt Robusta sẻ chín đỏ từ **Buôn Ma Thuột (Đắk Lắk, độ cao 550m – 800m)** và hạt Arabica Catimor/Bourbon từ **Cầu Đất (Đà Lạt, độ cao 1.500m)**.\n• **Rang mới mỗi ngày:** Xưởng rang mẻ nhỏ (Small-batch Roasting) và xay miễn phí theo đúng dụng cụ pha của bạn.\n• **Hotline & Zalo hỗ trợ:** `1900 6868` — Email: `hello@moccoffee.vn`',
      intent: 'brand_story',
      recommendedProducts: products.slice(0, 2),
      suggestions: [
        '☕ Tư vấn loại cà phê bán chạy nhất',
        '🫖 Cà phê nào hợp pha Phin sữa đá?',
        '📦 Kiểm tra đơn hàng của tôi',
      ],
    };
  }

  // 6. Tư vấn chọn cà phê theo gu thưởng thức (Barista Sommelier Engine)
  const isAskingRecommendation =
    /(tư vấn|chọn|loại nào|ngon|đậm|mạnh|sữa đá|đen đá|phin|chua|thơm|arabica|robusta|espresso|pha máy|blend|quà|biếu|giá|menu|sản phẩm|mua|gợi ý|ít cafein|say cà phê)/i.test(
      q
    );

  if (isAskingRecommendation) {
    // Phân tích gu cụ thể
    if (/(chua thanh|thơm|hoa quả|trái cây|ít cafein|say cà phê|nhẹ nhàng|arabica|v60|pour over|cold brew)/i.test(q)) {
      const matched = products.filter(
        (p) =>
          p.slug.includes('arabica') ||
          p.slug.includes('espresso') ||
          p.name.toLowerCase().includes('arabica')
      );
      return {
        reply:
          '🌸 Với gu thích **hương thơm thanh tao, vị chua thanh dịu của trái cây chín, hậu ngọt mật ong và êm dịu (ít gây say)**, mình đặc biệt gợi ý cho bạn dòng **Arabica Cầu Đất (100% Trái Chín)** thu hái ở độ cao 1.500m tại Đà Lạt.\n\nDòng này cực kỳ hợp để pha **Pour Over (V60), Cold Brew, Pha Máy** hoặc phối trộn thêm vào Phin cho dậy hương thơm!',
        intent: 'recommendation',
        recommendedProducts: matched.length > 0 ? matched : products.slice(0, 2),
        suggestions: [
          '🫖 Còn loại nào đậm đà pha Phin sữa đá?',
          '🧊 Cách ủ Cold Brew với Arabica Cầu Đất',
          '🚚 Mua bao nhiêu thì được Freeship?',
        ],
      };
    }

    if (/(pha máy|espresso|latte|cappuccino|americano|crema)/i.test(q)) {
      const matched = products.filter(
        (p) => p.slug.includes('espresso') || p.slug.includes('arabica')
      );
      return {
        reply:
          '☕ Nếu bạn dùng **máy pha Espresso tại nhà hoặc văn phòng**, dòng **Espresso House Blend** (tỷ lệ vàng Arabica Cầu Đất & Robusta Honey) và **Arabica Cầu Đất** là lựa chọn hoàn hảo nhất!\n\nLớp crema dày mịn màu hạt dẻ, hương hạt dẻ nướng hòa quyện bơ đậu phộng, rất cân bằng cả khi uống **Espresso nguyên bản, Americano hay pha Latte/Cappuccino**.',
        intent: 'recommendation',
        recommendedProducts: matched.length > 0 ? matched : products.slice(0, 2),
        suggestions: [
          '🫖 Tư vấn thêm dòng pha Phin đậm đà',
          '📦 Mình muốn kiểm tra đơn hàng',
          '🚚 Chính sách giao hàng toàn quốc',
        ],
      };
    }

    if (/(đậm|mạnh|phin|sữa đá|đen đá|tỉnh táo|robusta|ít chua|không chua|truyền thống)/i.test(q)) {
      const matched = products.filter(
        (p) => p.slug.includes('robusta') || p.slug.includes('phin')
      );
      return {
        reply:
          '🔥 Nếu bạn yêu thích **gu cà phê Việt truyền thống: đậm đà, sánh quyện, không chua, hậu ngọt sô-cô-la đen và giúp tỉnh táo tức thì**, bạn nhất định phải thử bộ đôi bán chạy nhất của MỘC:\n\n1. **Robusta Buôn Ma Thuột (Chế biến Honey):** 100% Robusta sẻ Đắk Lắk rang đậm vừa, cực kỳ mạnh mẽ.\n2. **Blend Phin Việt (70% Robusta – 30% Arabica):** Đậm vị truyền thống nhưng có thêm tầng hương thơm quyến rũ của Arabica Cầu Đất, pha **cà phê sữa đá** hay **đen đá** đều tuyệt hảo!',
        intent: 'recommendation',
        recommendedProducts: matched.length > 0 ? matched : products.slice(0, 2),
        suggestions: [
          '🌸 Có loại nào thơm nhẹ, ít cafein hơn không?',
          '🫖 Hướng dẫn pha Phin sánh đậm',
          '📦 Kiểm tra đơn hàng của tôi',
        ],
      };
    }

    // Tổng quan tất cả dòng cà phê của MỘC Coffee
    const summaryLines = products
      .slice(0, 4)
      .map(
        (p, idx) =>
          `${idx + 1}. **${p.name}** (${p.origin}) — **${formatVND(p.sale_price ?? p.price)}** / gói ${p.weight_grams}g: *${p.tasting_notes}*`
      )
      .join('\n');

    return {
      reply: `☕ Hiện tại **MỘC Coffee** có 4 dòng cà phê rang mộc tuyển chọn (hỗ trợ để **Nguyên hạt** hoặc **Xay miễn phí** theo phin/máy của bạn):\n\n${summaryLines}\n\nBạn thường thích uống **pha Phin đậm đà (đen đá/sữa đá)**, **pha Máy Espresso** hay thích vị **thơm thanh nhẹ nhàng** để mình chọn đúng loại hợp gu nhất cho bạn nhé?`,
      intent: 'recommendation',
      recommendedProducts: products.slice(0, 4),
      suggestions: [
        '🫖 Mình thích pha Phin đậm đà, sữa đá',
        '🌸 Mình thích vị thơm thanh, ít đắng',
        '☕ Mình tìm cà phê pha máy Espresso',
        '📦 Kiểm tra đơn hàng của tôi',
      ],
    };
  }

  // 7. Nếu có cấu hình GEMINI_API_KEY trên môi trường Cloudflare, có thể gọi Gemini 2.5 Flash kèm dữ liệu D1 thực tế
  const geminiKey = (c.env as any).GEMINI_API_KEY;
  if (geminiKey && typeof geminiKey === 'string' && geminiKey.trim().length > 10) {
    try {
      const catalogContext = products
        .map(
          (p) =>
            `- ${p.name} (Slug: ${p.slug}, Vùng: ${p.origin}, Giá: ${formatVND(p.sale_price ?? p.price)}, Hương vị: ${p.tasting_notes}, Tồn kho: ${p.stock})`
        )
        .join('\n');

      const sysPrompt = `Bạn là Trợ lý Barista của thương hiệu cà phê đặc sản Việt Nam "MỘC Coffee — Hương Vị Việt. Đánh Thức Đam Mê.".
Hãy trả lời ngắn gọn, ấm áp, lịch sự bằng tiếng Việt.
Danh mục sản phẩm thực tế trong kho D1:
${catalogContext}
Chính sách giao hàng: Phí ship ${formatVND(shippingFee)}, miễn phí vận chuyển cho đơn từ ${formatVND(freeThreshold)}.`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sysPrompt }] },
            contents: [
              ...history.slice(-6).map((h) => ({
                role: h.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: h.content }],
              })),
              { role: 'user', parts: [{ text: message }] },
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
            intent: 'general',
            recommendedProducts: products.slice(0, 2),
            suggestions: [
              '☕ Tư vấn cà phê pha Phin đậm đà',
              '🌸 Tư vấn Arabica Cầu Đất',
              '📦 Kiểm tra đơn hàng của tôi',
            ],
          };
        }
      }
    } catch {
      // Fallback mượt mà về Barista Engine nội bộ nếu mạng hoặc key lỗi
    }
  }

  // 8. Lời chào hoặc phản hồi mặc định thân thiện kèm gợi ý thông minh
  const greetingName = customer ? ` **${customer.full_name}**` : '';
  return {
    reply: `Xin chào${greetingName}! 👋 Mình là **Trợ lý Barista của MỘC Coffee**.\n\nMình có thể giúp bạn:\n• ☕ **Tư vấn chọn hạt cà phê** hợp gu (Pha Phin truyền thống, Sữa đá, Pha máy Espresso, Pour Over hay Cold Brew).\n• 📦 **Tra cứu trạng thái đơn hàng** ngay tức thì bằng Số điện thoại hoặc Mã đơn.\n• 📖 **Hướng dẫn công thức pha chế** & bảo quản cà phê rang mộc.\n\nHôm nay bạn đang tìm hương vị cà phê như thế nào ạ?`,
    intent: 'greeting',
    recommendedProducts: products.slice(0, 2),
    suggestions: [
      '🫖 Tư vấn cà phê pha Phin đậm đà',
      '🌸 Cà phê Arabica thơm hương hoa quả',
      '☕ Cà phê pha máy Espresso',
      '📦 Kiểm tra đơn hàng của tôi',
      '📖 Hướng dẫn pha Phin chuẩn vị',
    ],
  };
}
