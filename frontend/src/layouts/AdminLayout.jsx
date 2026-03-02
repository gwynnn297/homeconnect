import React from 'react';
import HeaderComponent from '../components/HeaderComponent';
import AdminSidebarComponent from '../components/AdminSidebarComponent';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
    return (
        <div className="admin-layout-wrapper">
            <HeaderComponent />
            <div className="admin-layout-body">
                <AdminSidebarComponent />
                <main className="content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
