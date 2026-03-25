import React from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import './AdminSimplePage.css';

const AdminWalletTransactionsPage = () => {
  return (
    <AdminLayout>
      <div className="admin-simple-page">
        <div className="admin-simple-card">
          <h1 className="admin-simple-title">Ví &amp; Giao dịch</h1>
          <p className="admin-simple-desc">
            Trang này đang được phát triển. Khi có API tổng hợp, admin sẽ xem lịch sử giao dịch, đối soát và thống kê nạp/giữ/thanh toán.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminWalletTransactionsPage;