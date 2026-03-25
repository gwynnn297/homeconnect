import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import './AdminSimplePage.css';

const AdminBookingsPage = () => {
  return (
    <AdminLayout>
      <div className="admin-simple-page">
        <div className="admin-simple-card">
          <h1 className="admin-simple-title">Quản lý Booking</h1>
          <p className="admin-simple-desc">
            Trang này đang được phát triển. Mục tiêu: hiển thị booking theo trạng thái (pending/confirmed/in_progress/...), hỗ trợ lọc theo thời gian và hành động admin.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminBookingsPage;