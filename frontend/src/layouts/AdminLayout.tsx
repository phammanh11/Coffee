import React, { useState } from 'react';
import { Link, NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  FileText,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useAdminMe } from '../hooks/useQueries';
import { api } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ToastContext';

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Sản phẩm', icon: Package },
  { to: '/admin/categories', label: 'Danh mục', icon: FolderTree },
  { to: '/admin/orders', label: 'Đơn hàng', icon: ShoppingCart },
  { to: '/admin/content', label: 'Nội dung & R2', icon: FileText },
];

export function AdminLayout() {
  const { data, isLoading, isError } = useAdminMe();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F2EA] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#4A2E24] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#777067]">Đang kiểm tra phiên đăng nhập quản trị...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.user) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await api.adminLogout();
      qc.clear();
      showToast('Đã đăng xuất khỏi trang quản trị.');
      navigate('/admin/login');
    } catch {
      navigate('/admin/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F2EA] text-[#171512] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-[#171512] text-[#FFFDF9] px-4 h-14 flex items-center justify-between">
        <span className="font-serif-display font-bold text-lg">
          MỘC <span className="text-[#E5B287] font-normal">Admin</span>
        </span>
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-white/10"
          aria-label="Mở menu quản trị"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'block' : 'hidden'
        } lg:flex lg:flex-col lg:w-64 bg-[#171512] text-[#F7F2EA] shrink-0 border-r border-white/10`}
      >
        <div className="p-6 border-b border-white/10 hidden lg:block">
          <Link to="/admin" className="font-serif-display text-2xl font-bold text-[#FFFDF9]">
            MỘC <span className="text-[#E5B287] font-normal">Admin</span>
          </Link>
          <p className="text-xs text-[#F7F2EA]/60 mt-1 truncate">{data.user.email}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#A65F3B] text-[#FFFDF9]'
                      : 'text-[#F7F2EA]/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2 px-3.5 py-2 rounded text-xs text-[#E5B287] hover:bg-white/5"
          >
            <ExternalLink className="w-4 h-4" />
            Xem trang khách hàng
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded text-xs text-red-300 hover:bg-red-950/40 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
