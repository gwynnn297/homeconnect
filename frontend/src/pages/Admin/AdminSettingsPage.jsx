import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import './AdminSimplePage.css';

const AdminSettingsPage = () => {
  return (
    <AdminLayout>
      <div className="admin-simple-page">
        <div className="admin-simple-card">
          <h1 className="admin-simple-title">Cài đặt hệ thống</h1>
          <p className="admin-simple-desc">
            Trang này đang được phát triển. Bạn có thể dùng module này để cấu hình dịch vụ, giới hạn rate limiter, và các thông số vận hành.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettingsPage;