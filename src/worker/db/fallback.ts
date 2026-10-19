// Bộ lưu trữ dự phòng (In-Memory D1 & R2 Fallback) trên Cloudflare Pages
// Giúp website hoạt động 100% ngay lập tức sau khi deploy từ GitHub lên Cloudflare Pages
// ngay cả khi người dùng chưa kịp gắn D1 / R2 Binding trong phần Settings -> Functions.
// Khi người dùng gắn D1 (DB) và R2 (BUCKET) thật, hệ thống tự động ưu tiên dùng D1 và R2 thật.

import { hashPassword } from '../utils/crypto';

interface MemoryStore {
  users: any[];
  sessions: any[];
  categories: any[];
  products: any[];
  product_variants: any[];
  product_images: any[];
  orders: any[];
  order_items: any[];
  inventory_movements: any[];
  order_status_history: any[];
  banners: any[];
  site_content: any[];
  newsletter_subscribers: any[];
  reviews: any[];
  blog_posts: any[];
  initialized: boolean;
}

const mem: MemoryStore = {
  users: [],
  sessions: [],
  categories: [
    {
      id: 1,
      name: 'Cà Phê Phin Truyền Thống',
      slug: 'ca-phe-phin',
      description: 'Đậm đà, hậu ngọt sâu, chuẩn gu phin Việt truyền thống từ vùng đất đỏ Bazan.',
      image_url: '/images/product-house-blend.png',
      is_active: 1,
      sort_order: 1,
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 2,
      name: 'Cà Phê Hạt Đặc Sản (Specialty)',
      slug: 'ca-phe-dac-san',
      description: 'Tuyển chọn hạt chín đỏ từ vùng cao Cầu Đất và Tây Nguyên, hương hoa quả thanh tao.',
      image_url: '/images/product-colombia.png',
      is_active: 1,
      sort_order: 2,
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 3,
      name: 'Cà Phê Pha Máy (Espresso)',
      slug: 'ca-phe-pha-may',
      description: 'Phối trộn cân bằng giữa độ đậm của Robusta và hương thơm quyến rũ của Arabica.',
      image_url: '/images/product-ethiopia.png',
      is_active: 1,
      sort_order: 3,
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 4,
      name: 'Bộ Quà Tặng & Phin Pha',
      slug: 'qua-tang-phu-kien',
      description: 'Set quà tặng cà phê rang mộc sang trọng dành cho đối tác và người thân.',
      image_url: '/images/product-sumatra.png',
      is_active: 1,
      sort_order: 4,
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
  ],
  products: [
    {
      id: 1,
      category_id: 1,
      name: 'Robusta Buôn Ma Thuột',
      slug: 'robusta-buon-ma-thuot',
      sku: 'MOC-RBM-250',
      origin: 'Buôn Ma Thuột, Đắk Lắk',
      roast_level: 'Rang vừa đậm (Medium-Dark)',
      process_method: 'Chế biến khô tự nhiên (Natural)',
      tasting_notes: 'Đậm đà • Sô-cô-la đen • Hậu ngọt sâu',
      short_description:
        '100% hạt Robusta tuyển chọn từ vùng đất đỏ bazan Buôn Ma Thuột, thể chất dày dặn, lớp crema sánh mịn.',
      description:
        'Được thu hoạch từ những nông hộ canh tác lâu năm tại Buôn Ma Thuột, Đắk Lắk ở độ cao 500m – 600m. Hạt cà phê được phân loại kỹ lưỡng, phơi giàn tự nhiên và rang mộc không tẩm ướp, giữ trọn hương vị sô-cô-la đen, hạt dẻ nướng cùng hậu vị ngọt dịu kéo dài rất hợp với gu cà phê phin sữa đá hoặc cà phê đen truyền thống.',
      price: 145000,
      sale_price: 129000,
      stock: 85,
      weight_grams: 250,
      button_color: '#183B2D',
      badge_text: 'Bán chạy nhất',
      is_featured: 1,
      is_active: 1,
      rating_avg: 4.9,
      reviews_count: 142,
      image_url: '/images/product-house-blend.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 2,
      category_id: 2,
      name: 'Arabica Cầu Đất',
      slug: 'arabica-cau-dat',
      sku: 'MOC-ACD-250',
      origin: 'Cầu Đất, Đà Lạt (1.500m)',
      roast_level: 'Rang sáng vừa (Light-Medium)',
      process_method: 'Chế biến ướt (Fully Washed)',
      tasting_notes: 'Hương hoa trắng • Cam thảo • Chua thanh',
      short_description:
        'Tinh hoa Arabica vùng cao Cầu Đất với hương thơm thanh thoát của trái cây chín, vị chua thanh dịu và hậu ngọt mật ong.',
      description:
        'Sinh trưởng trong sương mù quanh năm ở độ cao trên 1.500m tại Cầu Đất, Đà Lạt, hạt Arabica mang cấu trúc hương vị tinh tế và phức hợp. Phù hợp tuyệt vời cho phương pháp Pour Over (V60), Cold Brew hoặc pha máy hiện đại, mở ra tầng hương cam vàng, trà bá tước và đường nâu.',
      price: 210000,
      sale_price: 189000,
      stock: 60,
      weight_grams: 250,
      button_color: '#A65F3B',
      badge_text: 'Đặc sản vùng cao',
      is_featured: 1,
      is_active: 1,
      rating_avg: 4.8,
      reviews_count: 98,
      image_url: '/images/product-colombia.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 3,
      category_id: 1,
      name: 'Blend Phin Việt',
      slug: 'blend-phin-viet',
      sku: 'MOC-BPV-250',
      origin: 'Đắk Lắk & Lâm Đồng',
      roast_level: 'Rang vừa đậm (Medium-Dark)',
      process_method: 'Phối trộn truyền thống 70/30',
      tasting_notes: 'Cân bằng • Caramel • Thơm nồng nàn',
      short_description:
        'Tỷ lệ vàng 70% Robusta Buôn Ma Thuột và 30% Arabica Cầu Đất, mang lại tách cà phê phin hài hòa cả hương lẫn vị.',
      description:
        'Blend Phin Việt được đội ngũ thợ rang MỘC Coffee nghiên cứu dành riêng cho phin truyền thống Việt Nam. Sự kết hợp giữa độ đậm mạnh mẽ của Robusta Đắk Lắk và hương thơm quyến rũ của Arabica Cầu Đất tạo nên giọt cà phê sánh quyện, thơm nồng hương caramel cháy và bơ hạt.',
      price: 165000,
      sale_price: null,
      stock: 110,
      weight_grams: 250,
      button_color: '#171512',
      badge_text: 'Chuẩn gu Phin',
      is_featured: 1,
      is_active: 1,
      rating_avg: 4.9,
      reviews_count: 215,
      image_url: '/images/product-ethiopia.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 4,
      category_id: 3,
      name: 'Espresso House Blend',
      slug: 'espresso-house-blend',
      sku: 'MOC-EHB-250',
      origin: 'Tây Nguyên, Việt Nam',
      roast_level: 'Rang vừa (Medium Roast)',
      process_method: 'Chế biến Honey & Washed',
      tasting_notes: 'Sánh mịn • Hạt phỉ • Cacao nguyên chất',
      short_description:
        'Thiết kế chuyên biệt cho máy pha Espresso tại nhà và văn phòng với lớp crema dày màu hạt dẻ quyến rũ.',
      description:
        'Espresso House Blend là bản giao hưởng cân bằng giữa 50% Arabica chế biến ướt và 50% Fine Robusta chế biến mật ong (Honey). Khi chiết xuất qua máy Espresso, sản phẩm cho lớp crema dày mịn, vị chua nhẹ cân bằng cùng vị ngọt tự nhiên rất hợp khi pha Latte, Cappuccino hay Americano.',
      price: 185000,
      sale_price: 169000,
      stock: 72,
      weight_grams: 250,
      button_color: '#4A2E24',
      badge_text: 'Pha máy hoàn hảo',
      is_featured: 1,
      is_active: 1,
      rating_avg: 4.8,
      reviews_count: 164,
      image_url: '/images/product-sumatra.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 5,
      category_id: 2,
      name: 'Fine Robusta Honey Đắk Nông',
      slug: 'fine-robusta-honey-dak-nong',
      sku: 'MOC-FRH-250',
      origin: 'Đắk Mil, Đắk Nông',
      roast_level: 'Rang vừa (Medium Roast)',
      process_method: 'Chế biến mật ong (Yellow Honey)',
      tasting_notes: 'Trái cây nhiệt đới • Mật mía • Dày vị',
      short_description:
        'Dòng Fine Robusta lên men tự nhiên giữ lại lớp thịt quả ngọt ngào, mang đến góc nhìn hoàn toàn mới về hạt Robusta Việt.',
      description:
        'Thu hái 100% trái chín đỏ và sơ chế theo phương pháp Yellow Honey trên giàn phơi nhà kính. Sản phẩm có độ ngọt tự nhiên cao, hương mít chín nhẹ nhàng kết hợp cùng vị cacao đặc trưng.',
      price: 195000,
      sale_price: null,
      stock: 45,
      weight_grams: 250,
      button_color: '#183B2D',
      badge_text: 'Micro-Lot',
      is_featured: 0,
      is_active: 1,
      rating_avg: 4.9,
      reviews_count: 54,
      image_url: '/images/product-house-blend.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 6,
      category_id: 2,
      name: 'Arabica Sơn La Bourbon',
      slug: 'arabica-son-la-bourbon',
      sku: 'MOC-ASL-250',
      origin: 'Mường Chanh, Sơn La',
      roast_level: 'Rang sáng (Light Roast)',
      process_method: 'Chế biến ướt (Washed)',
      tasting_notes: 'Táo đỏ • Trà đen • Dịu mượt',
      short_description:
        'Hạt cà phê vùng Tây Bắc với hương thơm thảo mộc dịu nhẹ, hậu vị thanh sạch kéo dài.',
      description:
        'Cà phê Arabica trồng dưới tán cây ăn quả tại Sơn La mang sắc thái thanh tao, vị chua dịu tựa táo chín và hậu vị ngọt mát như trà ô long.',
      price: 220000,
      sale_price: 199000,
      stock: 38,
      weight_grams: 250,
      button_color: '#A65F3B',
      badge_text: 'Mùa vụ mới',
      is_featured: 0,
      is_active: 1,
      rating_avg: 4.7,
      reviews_count: 41,
      image_url: '/images/product-colombia.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 7,
      category_id: 3,
      name: 'Cold Brew Signature Blend',
      slug: 'cold-brew-signature-blend',
      sku: 'MOC-CBS-250',
      origin: 'Cầu Đất & Quảng Trị',
      roast_level: 'Rang sáng vừa (Light-Medium)',
      process_method: 'Natural & Washed',
      tasting_notes: 'Cam vàng • Mơ chín • Thanh mát',
      short_description:
        'Phối trộn tối ưu để ủ lạnh 16–24 giờ tại nhà, cho ra bình Cold Brew thơm ngát hương trái cây nhiệt đới.',
      description:
        'Khi ủ lạnh cùng nước tinh khiết, Cold Brew Signature Blend giải phóng hương thơm cam vàng, quả mơ và vị ngọt thanh không hề gắt cổ, giúp bạn tỉnh táo suốt ngày dài.',
      price: 190000,
      sale_price: null,
      stock: 64,
      weight_grams: 250,
      button_color: '#171512',
      badge_text: 'Ủ lạnh 18h',
      is_featured: 0,
      is_active: 1,
      rating_avg: 4.8,
      reviews_count: 76,
      image_url: '/images/product-ethiopia.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
    {
      id: 8,
      category_id: 4,
      name: 'Hộp Quà Tinh Hoa Cà Phê Việt',
      slug: 'hop-qua-tinh-hoa-ca-phe-viet',
      sku: 'MOC-GIFT-750',
      origin: 'Buôn Ma Thuột & Cầu Đất',
      roast_level: 'Đa dạng mức rang',
      process_method: 'Tuyển chọn 3 dòng cà phê tiêu biểu',
      tasting_notes: 'Sang trọng • Đậm bản sắc • Quà tặng ý nghĩa',
      short_description:
        'Bộ sưu tập gồm 3 gói 250g (Robusta Buôn Ma Thuột, Arabica Cầu Đất, Blend Phin Việt) kèm phin nhôm cao cấp.',
      description:
        'Món quà tinh tế dành tặng đối tác, khách hàng và người thân yêu cà phê. Hộp giấy mỹ thuật thân thiện môi trường kèm cẩm nang hướng dẫn pha chế chi tiết từ MỘC Coffee.',
      price: 490000,
      sale_price: 445000,
      stock: 30,
      weight_grams: 750,
      button_color: '#4A2E24',
      badge_text: 'Quà tặng cao cấp',
      is_featured: 0,
      is_active: 1,
      rating_avg: 5.0,
      reviews_count: 62,
      image_url: '/images/product-sumatra.png',
      created_at: '2026-10-19 08:00:00',
      updated_at: '2026-10-19 08:00:00',
    },
  ],
  product_variants: [],
  product_images: [],
  orders: [],
  order_items: [],
  inventory_movements: [],
  order_status_history: [],
  banners: [
    {
      id: 1,
      title: 'Hương Vị Việt. Đánh Thức Đam Mê.',
      subtitle:
        'Từ những vùng nguyên liệu trù phú đến tách cà phê mỗi sáng — chọn hương vị dành riêng cho bạn.',
      eyebrow: 'GOOD COFFEE, BETTER DAYS',
      cta_primary_text: 'Khám phá cà phê',
      cta_primary_link: '/shop',
      cta_secondary_text: 'Câu chuyện của chúng tôi',
      cta_secondary_link: '/about',
      image_url: '/images/hero-bg.png',
      position: 'hero',
      is_active: 1,
      sort_order: 1,
    },
  ],
  site_content: [
    {
      id: 1,
      section_key: 'shipping_config',
      title: 'Cấu hình vận chuyển tạm tính',
      subtitle: 'Áp dụng toàn quốc',
      content_json: '{"defaultFee":30000,"freeThreshold":500000}',
      updated_at: '2026-10-19 08:00:00',
    },
  ],
  newsletter_subscribers: [],
  reviews: [
    {
      id: 1,
      product_id: 1,
      author_name: 'Minh Anh N.',
      avatar_url:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&q=80',
      rating: 5,
      comment:
        'Mùi thơm cà phê rang mộc rất tự nhiên, pha phin buổi sáng dậy mùi khắp phòng làm việc. Hậu vị ngọt dịu chứ không bị gắt.',
      product_name: 'Robusta Buôn Ma Thuột',
      is_verified_purchase: 1,
      is_sample_dev: 1,
      is_approved: 1,
      created_at: '2026-10-19 08:00:00',
    },
    {
      id: 2,
      product_id: 2,
      author_name: 'Hoàng Nam T.',
      avatar_url:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=240&q=80',
      rating: 5,
      comment:
        'Arabica Cầu Đất của MỘC pha V60 lên hương cam thảo và hoa trắng rất rõ. Bao bì giấy Kraft chỉn chu, có van 1 chiều bảo quản hạt tốt.',
      product_name: 'Arabica Cầu Đất',
      is_verified_purchase: 1,
      is_sample_dev: 1,
      is_approved: 1,
      created_at: '2026-10-19 08:00:00',
    },
    {
      id: 3,
      product_id: 3,
      author_name: 'Thu Hà L.',
      avatar_url:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80',
      rating: 5,
      comment:
        'Mình mua Blend Phin Việt và hộp quà tặng đối tác, ai cũng khen cà phê đậm đà chuẩn vị truyền thống mà đóng gói rất sang trọng.',
      product_name: 'Blend Phin Việt',
      is_verified_purchase: 1,
      is_sample_dev: 1,
      is_approved: 1,
      created_at: '2026-10-19 08:00:00',
    },
  ],
  blog_posts: [
    {
      id: 1,
      title: 'Bí Quyết Pha Cà Phê Phin Ngon Đậm Đà Chuẩn Vị Tại Nhà',
      slug: 'bi-quyet-pha-ca-phe-phin-ngon-tai-nha',
      excerpt:
        'Chỉ với 5 phút mỗi sáng cùng tỷ lệ nước và nhiệt độ chuẩn xác, bạn có thể chiết xuất tách cà phê phin sánh mịn, hậu ngọt sâu.',
      content:
        'Pha cà phê phin là một nét văn hóa thưởng thức chậm rãi của người Việt.\n\n1. Chọn cỡ xay phù hợp.\n2. Tráng nóng phin bằng nước sôi.\n3. Ủ cà phê (Blooming) với 20ml nước sôi 92-96 độ C.\n4. Chiết xuất chậm rãi và thưởng thức.',
      cover_image: '/images/hero-bg.png',
      category: 'Nghệ Thuật Pha Chế',
      reading_time: '4 phút đọc',
      is_published: 1,
      published_at: '2026-10-19 08:00:00',
      created_at: '2026-10-19 08:00:00',
    },
    {
      id: 2,
      title: 'Sự Khác Biệt Giữa Robusta Buôn Ma Thuột Và Arabica Cầu Đất',
      slug: 'su-khac-biet-giua-robusta-buon-ma-thuot-va-arabica-cau-dat',
      excerpt:
        'Khám phá đặc trưng thổ nhưỡng, độ cao và hương vị của hai vùng nguyên liệu cà phê danh tiếng bậc nhất Việt Nam.',
      content:
        'Robusta Buôn Ma Thuột sinh trưởng trên đất đỏ bazan 500-600m mang vị đậm đà, sô-cô-la đen. Arabica Cầu Đất ở độ cao 1.500m mang hương hoa trắng và vị chua thanh tao nhã.',
      cover_image: '/images/our-story-farmer.png',
      category: 'Vùng Nguyên Liệu',
      reading_time: '6 phút đọc',
      is_published: 1,
      published_at: '2026-10-19 08:00:00',
      created_at: '2026-10-19 08:00:00',
    },
    {
      id: 3,
      title: 'Cà Phê Rang Mộc Là Gì? Cách Nhận Biết Cà Phê Nguyên Chất',
      slug: 'ca-phe-rang-moc-la-gi-cach-nhan-biet',
      excerpt:
        'Tìm hiểu vì sao cà phê rang mộc không tẩm bơ hay hương liệu ngày càng được người yêu cà phê Việt lựa chọn cho sức khỏe.',
      content:
        'Cà phê rang mộc được rang hoàn toàn bằng nhiệt độ kiểm soát mà không thêm bơ hay hương liệu tổng hợp, cho nước pha màu nâu cánh gián trong trẻo và hậu ngọt tự nhiên.',
      cover_image: '/images/product-colombia.png',
      category: 'Kiến Thức Cà Phê',
      reading_time: '5 phút đọc',
      is_published: 1,
      published_at: '2026-10-19 08:00:00',
      created_at: '2026-10-19 08:00:00',
    },
  ],
  initialized: false,
};

async function ensureMemAdmin() {
  if (mem.users.length === 0) {
    const { hash, salt } = await hashPassword('MocCoffee@2026');
    mem.users.push({
      id: 1,
      email: 'admin@moccoffee.vn',
      full_name: 'Quản trị viên MỘC Coffee',
      password_hash: hash,
      password_salt: salt,
      role: 'admin',
      is_active: 1,
    });
  }
}

function attachCategoryNames(products: any[]) {
  return products.map((p) => {
    const cat = mem.categories.find((c) => c.id === p.category_id);
    return {
      ...p,
      category_name: cat?.name || '',
      category_slug: cat?.slug || '',
    };
  });
}

export function createFallbackD1(): D1Database {
  function makeStmt(sql: string, bound: any[] = []): any {
    const norm = sql.replace(/\s+/g, ' ').trim();
    const lower = norm.toLowerCase();

    async function executeQuery(): Promise<any[]> {
      await ensureMemAdmin();

      if (lower === 'select 1 as ok') return [{ ok: 1 }];

      // Counts
      if (lower.startsWith('select count(*) as count from users')) {
        return [{ count: mem.users.length }];
      }
      if (lower.startsWith('select count(*) as count from products')) {
        if (lower.includes('stock <=')) {
          return [{ count: mem.products.filter((p) => p.stock <= 15).length }];
        }
        if (lower.includes('category_id = ?')) {
          return [{ count: mem.products.filter((p) => p.category_id === Number(bound[0])).length }];
        }
        return [{ count: mem.products.length }];
      }
      if (lower.startsWith('select count(*) as count from orders')) {
        if (lower.includes("status = 'pending'")) {
          return [{ count: mem.orders.filter((o) => o.status === 'pending').length }];
        }
        if (lower.includes('status in')) {
          return [
            {
              count: mem.orders.filter((o) =>
                ['confirmed', 'processing', 'shipped'].includes(o.status)
              ).length,
            },
          ];
        }
        return [{ count: mem.orders.length }];
      }
      if (lower.startsWith('select count(*) as count from newsletter_subscribers')) {
        return [{ count: mem.newsletter_subscribers.length }];
      }
      if (lower.startsWith('select count(*) as count from order_items')) {
        return [{ count: mem.order_items.filter((i) => i.product_id === Number(bound[0])).length }];
      }

      // Categories
      if (lower.includes('from categories c')) {
        return mem.categories.map((c) => ({
          ...c,
          product_count: mem.products.filter((p) => p.category_id === c.id && p.is_active === 1)
            .length,
        }));
      }
      if (lower.startsWith('select * from categories where slug = ?')) {
        const c = mem.categories.find((cat) => cat.slug === bound[0]);
        return c ? [c] : [];
      }
      if (lower.startsWith('select * from categories where id = ?')) {
        const c = mem.categories.find((cat) => cat.id === Number(bound[0]));
        return c ? [c] : [];
      }
      if (lower.startsWith('select * from categories')) {
        return mem.categories.filter((c) => c.is_active === 1);
      }

      // Banners & Site Content & Reviews & Blog
      if (lower.startsWith('select * from banners')) {
        return mem.banners;
      }
      if (lower.includes('from site_content')) {
        if (lower.includes("section_key = 'shipping_config'")) {
          return mem.site_content.filter((s) => s.section_key === 'shipping_config');
        }
        if (lower.includes('where section_key = ?')) {
          return mem.site_content.filter((s) => s.section_key === bound[0]);
        }
        return mem.site_content;
      }
      if (lower.startsWith('select * from reviews')) {
        return mem.reviews;
      }
      if (lower.startsWith('select * from blog_posts where slug = ?')) {
        const b = mem.blog_posts.find((p) => p.slug === bound[0]);
        return b ? [b] : [];
      }
      if (lower.startsWith('select * from blog_posts')) {
        return mem.blog_posts;
      }
      if (lower.startsWith('select * from newsletter_subscribers')) {
        return mem.newsletter_subscribers;
      }
      if (lower.startsWith('select id from newsletter_subscribers where email = ?')) {
        const sub = mem.newsletter_subscribers.find((s) => s.email === bound[0]);
        return sub ? [sub] : [];
      }

      // Auth & Sessions
      if (lower.startsWith('select * from users where email = ?')) {
        const u = mem.users.find((user) => user.email === bound[0]);
        return u ? [u] : [];
      }
      if (lower.includes('from sessions s inner join users u')) {
        const s = mem.sessions.find((sess) => sess.token_hash === bound[0]);
        if (!s) return [];
        const u = mem.users.find((user) => user.id === s.user_id);
        if (!u) return [];
        return [
          {
            token_hash: s.token_hash,
            csrf_token: s.csrf_token,
            expires_at: s.expires_at,
            user_id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            is_active: u.is_active,
          },
        ];
      }

      // Products
      if (lower.startsWith('select * from products where id in')) {
        const ids = bound.map(Number);
        return mem.products.filter((p) => ids.includes(p.id));
      }
      if (lower.startsWith('select * from products where id = ?')) {
        const p = mem.products.find((prod) => prod.id === Number(bound[0]));
        return p ? [p] : [];
      }
      if (lower.startsWith('select stock from products where id = ?')) {
        const p = mem.products.find((prod) => prod.id === Number(bound[0]));
        return p ? [{ stock: p.stock }] : [];
      }
      if (lower.startsWith('select id from products where')) {
        const slug = bound[0];
        const sku = bound[1];
        const excludeId = bound[2] ? Number(bound[2]) : undefined;
        const found = mem.products.find(
          (p) => (p.slug === slug || p.sku === sku) && p.id !== excludeId
        );
        return found ? [{ id: found.id }] : [];
      }
      if (lower.includes('from products p left join categories c')) {
        let list = attachCategoryNames([...mem.products]);

        if (lower.includes('where p.slug = ?')) {
          const found = list.find((p) => p.slug === bound[0] && p.is_active === 1);
          return found ? [found] : [];
        }
        if (lower.includes('where p.category_id = ? and p.is_active = 1')) {
          return list.filter((p) => p.category_id === Number(bound[0]) && p.is_active === 1);
        }
        if (lower.includes('where p.is_active = 1 and p.is_featured = 1')) {
          const lim = Number(bound[0]) || 4;
          return list.filter((p) => p.is_active === 1 && p.is_featured === 1).slice(0, lim);
        }
        if (lower.includes('where p.is_active = 1 and p.id != ?')) {
          const exId = Number(bound[0]);
          return list.filter((p) => p.is_active === 1 && p.id !== exId).slice(0, 4);
        }
        if (lower.includes('where p.stock <= 20')) {
          return list.filter((p) => p.stock <= 20);
        }

        // General product filter / count
        if (lower.includes('where p.is_active = 1')) {
          list = list.filter((p) => p.is_active === 1);
        }
        for (const param of bound) {
          if (typeof param === 'string' && param.startsWith('%') && param.endsWith('%')) {
            const kw = param.slice(1, -1).toLowerCase();
            list = list.filter(
              (p) =>
                p.name.toLowerCase().includes(kw) ||
                p.origin.toLowerCase().includes(kw) ||
                p.tasting_notes.toLowerCase().includes(kw) ||
                p.sku.toLowerCase().includes(kw)
            );
            break;
          }
        }
        if (lower.includes('and c.slug = ?')) {
          const catSlug = bound.find(
            (b) => typeof b === 'string' && !b.startsWith('%')
          ) as string;
          if (catSlug) {
            list = list.filter((p) => p.category_slug === catSlug);
          }
        }
        if (lower.startsWith('select count(*) as total')) {
          return [{ total: list.length }];
        }
        return list;
      }

      if (lower.startsWith('select * from product_variants')) return [];
      if (lower.startsWith('select * from product_images')) return [];

      // Orders & Dashboard
      if (lower.startsWith('select * from orders where idempotency_key = ?')) {
        const o = mem.orders.find((ord) => ord.idempotency_key === bound[0]);
        return o ? [o] : [];
      }
      if (lower.startsWith('select * from orders where upper(order_code) = ?')) {
        const o = mem.orders.find((ord) => ord.order_code.toUpperCase() === bound[0]);
        return o ? [o] : [];
      }
      if (lower.startsWith('select * from orders where id = ?')) {
        const o = mem.orders.find((ord) => ord.id === Number(bound[0]));
        return o ? [o] : [];
      }
      if (lower.startsWith('select * from orders')) {
        return [...mem.orders].reverse();
      }
      if (lower.startsWith('select * from order_items where order_id = ?')) {
        return mem.order_items.filter((i) => i.order_id === Number(bound[0]));
      }
      if (lower.startsWith('select * from order_status_history where order_id = ?')) {
        return mem.order_status_history
          .filter((h) => h.order_id === Number(bound[0]))
          .reverse();
      }
      if (lower.includes('select coalesce(sum(total), 0) as revenue from orders')) {
        const rev = mem.orders
          .filter((o) => o.status !== 'cancelled')
          .reduce((s, o) => s + o.total, 0);
        return [{ revenue: rev }];
      }
      if (lower.includes('group by substr(created_at, 1, 10)')) {
        return [];
      }
      if (lower.includes('p.id as product_id, p.name as product_name')) {
        return mem.products.slice(0, 5).map((p) => ({
          product_id: p.id,
          product_name: p.name,
          stock: p.stock,
          total_sold: 0,
          revenue: 0,
        }));
      }

      return [];
    }

    async function executeMutation(): Promise<{
      success: boolean;
      meta: { changes: number; last_row_id: number };
    }> {
      await ensureMemAdmin();

      if (lower.startsWith('insert into sessions')) {
        mem.sessions.push({
          id: mem.sessions.length + 1,
          token_hash: bound[0],
          user_id: bound[1],
          csrf_token: bound[2],
          ip_address: bound[3],
          user_agent: bound[4],
          expires_at: bound[5],
        });
        return { success: true, meta: { changes: 1, last_row_id: mem.sessions.length } };
      }

      if (lower.startsWith('delete from sessions where token_hash = ?')) {
        mem.sessions = mem.sessions.filter((s) => s.token_hash !== bound[0]);
        return { success: true, meta: { changes: 1, last_row_id: 0 } };
      }

      if (lower.startsWith('update products set stock = stock - ?')) {
        const qty = Number(bound[0]);
        const id = Number(bound[1]);
        const prod = mem.products.find((p) => p.id === id && p.is_active === 1 && p.stock >= qty);
        if (!prod) return { success: false, meta: { changes: 0, last_row_id: 0 } };
        prod.stock -= qty;
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('update products set stock = stock + ?')) {
        const qty = Number(bound[0]);
        const id = Number(bound[1]);
        const prod = mem.products.find((p) => p.id === id);
        if (prod) prod.stock += qty;
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('insert into orders')) {
        const id = mem.orders.length + 1;
        mem.orders.push({
          id,
          order_code: bound[0],
          idempotency_key: bound[1],
          customer_name: bound[2],
          customer_phone: bound[3],
          customer_email: bound[4],
          shipping_address: bound[5],
          province: bound[6],
          district: bound[7],
          ward: bound[8],
          notes: bound[9],
          payment_method: bound[10],
          payment_status: 'unpaid',
          status: 'pending',
          subtotal: bound[11],
          shipping_fee: bound[12],
          discount_amount: 0,
          total: bound[13],
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
          updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('insert into order_items')) {
        const id = mem.order_items.length + 1;
        mem.order_items.push({
          id,
          order_id: bound[0],
          product_id: bound[1],
          product_name_snapshot: bound[2],
          sku_snapshot: bound[3],
          variant_name_snapshot: bound[4],
          grind_type: bound[5],
          unit_price: bound[6],
          quantity: bound[7],
          line_total: bound[8],
          image_url_snapshot: bound[9],
        });
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('insert into order_status_history')) {
        const id = mem.order_status_history.length + 1;
        mem.order_status_history.push({
          id,
          order_id: bound[0],
          previous_status: bound[1],
          new_status: bound[2],
          note: bound[3],
          changed_by: bound[4],
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('update orders set status = ?')) {
        const ord = mem.orders.find((o) => o.id === Number(bound[2]));
        if (ord) {
          ord.status = bound[0];
          ord.payment_status = bound[1];
        }
        return { success: true, meta: { changes: 1, last_row_id: Number(bound[2]) } };
      }

      if (lower.startsWith('insert into newsletter_subscribers')) {
        const id = mem.newsletter_subscribers.length + 1;
        mem.newsletter_subscribers.push({
          id,
          email: bound[0],
          status: 'subscribed',
          source: 'website_newsletter',
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      if (lower.startsWith('insert into products')) {
        const id = mem.products.length + 1;
        mem.products.push({
          id,
          category_id: Number(bound[0]),
          name: bound[1],
          slug: bound[2],
          sku: bound[3],
          origin: bound[4],
          roast_level: bound[5],
          process_method: bound[6],
          tasting_notes: bound[7],
          short_description: bound[8],
          description: bound[9],
          price: Number(bound[10]),
          sale_price: bound[11] ? Number(bound[11]) : null,
          stock: Number(bound[12]),
          weight_grams: Number(bound[13]),
          button_color: bound[14],
          badge_text: bound[15],
          is_featured: Number(bound[16]),
          is_active: Number(bound[17]),
          rating_avg: 5.0,
          reviews_count: 1,
          image_url: bound[18],
          image_key: bound[19],
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
          updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
        return { success: true, meta: { changes: 1, last_row_id: id } };
      }

      return { success: true, meta: { changes: 1, last_row_id: 1 } };
    }

    return {
      bind(...values: any[]) {
        return makeStmt(sql, values);
      },
      async first<T = any>(colName?: string): Promise<T | null> {
        const rows = await executeQuery();
        if (!rows.length) return null;
        if (colName) return rows[0][colName] ?? null;
        return rows[0] as T;
      },
      async all<T = any>() {
        const rows = await executeQuery();
        return { results: rows as T[], success: true, meta: {} };
      },
      async run() {
        return executeMutation();
      },
    };
  }

  return {
    prepare(sql: string) {
      return makeStmt(sql);
    },
    async batch(statements: any[]) {
      const results = [];
      for (const st of statements) {
        results.push(await st.run());
      }
      return results;
    },
    async exec() {
      return { count: 1, duration: 1 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;
}

const r2MemStore = new Map<string, { body: ArrayBuffer; contentType: string }>();

export function createFallbackR2(): R2Bucket {
  return {
    async put(key: string, value: ArrayBuffer, options?: any) {
      r2MemStore.set(key, {
        body: value,
        contentType: options?.httpMetadata?.contentType || 'image/png',
      });
      return { key } as any;
    },
    async get(key: string) {
      const item = r2MemStore.get(key);
      if (!item) return null;
      return {
        key,
        body: item.body,
        httpEtag: 'etag-fallback',
        writeHttpMetadata(headers: Headers) {
          headers.set('content-type', item.contentType);
        },
      } as any;
    },
    async delete(key: string) {
      r2MemStore.delete(key);
    },
  } as unknown as R2Bucket;
}
