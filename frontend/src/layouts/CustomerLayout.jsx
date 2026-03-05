import React from 'react';
import HeaderComponent from '../components/HeaderComponent';
import CustomerSidebarComponent from '../components/CustomerSidebarComponent';
import './CustomerLayout.css';

const CustomerLayout = ({ children }) => {
    return (
        <div className="customer-layout-wrapper">
            <HeaderComponent />
            <div className="customer-layout-body">
                <CustomerSidebarComponent />
                <main className="customer-content">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default CustomerLayout;
