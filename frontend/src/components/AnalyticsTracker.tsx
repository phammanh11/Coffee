import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../services/basinTracker';

/**
 * Component tự động lắng nghe sự kiện thay đổi URL trong React Router
 * và gửi telemetry lên Basin Catalog Stream
 */
export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    // Tránh track trang đăng nhập admin hoặc assets
    if (!location.pathname.startsWith('/admin/login')) {
      trackPageView(location.pathname);
    }
  }, [location.pathname, location.search]);

  return null;
}

