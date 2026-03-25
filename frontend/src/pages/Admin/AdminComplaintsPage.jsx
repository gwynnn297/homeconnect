import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import './AdminSimplePage.css';

const AdminComplaintsPage = () => {
  return (
    <AdminLayout>
      <div className="admin-simple-page">
        <div className="admin-simple-card">
          <h1 className="admin-simple-title">Khiếu nại &amp; Hoàn tiền</h1>
          <p className="admin-simple-desc">
            Trang này đang được phát triển. Dự kiến sẽ quản lý ticket/đơn khiếu nại, duyệt hoàn tiền và hiển thị trạng thái xử lý.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminComplaintsPage;