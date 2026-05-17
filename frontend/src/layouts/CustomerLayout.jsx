import React, { useEffect, useState } from 'react';
import AIChatbotComponent from '../components/AIChatbotComponent';
import HeaderComponent from '../components/HeaderComponent';
import CustomerSidebarComponent from '../components/CustomerSidebarComponent';
import SupportHotlineFab from '../components/SupportHotlineFab';
import './CustomerLayout.css';

const CustomerLayout = ({ children }) => {
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth > 768) {
                setMobileSidebarOpen(false);
            }
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    return (
        <div className="customer-layout-wrapper">
            <HeaderComponent showMenuButton onMenuClick={() => setMobileSidebarOpen(true)} />
            <div className={`customer-layout-body ${mobileSidebarOpen ? 'cs-sidebar-open' : ''}`}>
                <div
                    className={`cs-mobile-overlay ${mobileSidebarOpen ? 'open' : ''}`}
                    role="button"
                    tabIndex={-1}
                    aria-label="Đóng menu"
                    onClick={() => setMobileSidebarOpen(false)}
                    onKeyDown={() => setMobileSidebarOpen(false)}
                />

                <CustomerSidebarComponent onNavigate={() => setMobileSidebarOpen(false)} />
                <main className="customer-content">
                    {children}
                </main>
                <AIChatbotComponent />
                <SupportHotlineFab placement="left" />
            </div>
        </div>
    );
};

export default CustomerLayout;
