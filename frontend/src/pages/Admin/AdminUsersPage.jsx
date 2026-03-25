import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import './AdminSimplePage.css';

const AdminUsersPage = () => {
  return (
    <AdminLayout>
      <div className="admin-simple-page">
        <div className="admin-simple-card">
          <h1 className="admin-simple-title">Quản lý User</h1>
          <p className="admin-simple-desc">
            Trang này đang được phát triển. Khi hoàn tất API, bạn sẽ xem danh sách user, lọc theo role/trạng thái và thực hiện thao tác admin.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUsersPage;