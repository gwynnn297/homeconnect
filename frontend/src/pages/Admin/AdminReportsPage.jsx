import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import './AdminSimplePage.css';

const AdminReportsPage = () => {
  return (
    <AdminLayout>
      <div className="admin-simple-page">
        <div className="admin-simple-card">
          <h1 className="admin-simple-title">Báo cáo &amp; Thống kê</h1>
          <p className="admin-simple-desc">
            Trang này đang được phát triển. Hiện tại dashboard admin đã có thống kê cơ bản từ API <code>/api/v1/admin/statistics</code>.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminReportsPage;