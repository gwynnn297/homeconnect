import React from 'react';
import HeaderComponent from '../components/HeaderComponent';
import HelperSidebarComponent from '../components/HelperSidebarComponent';
import SupportHotlineFab from '../components/SupportHotlineFab';
import './HelperLayout.css';

const HelperLayout = ({ children }) => {
    return (
        <div className="helper-layout-wrapper">
            <HeaderComponent />
            <div className="helper-layout-body">
                <HelperSidebarComponent />
                <main className="content">
                    {children}
                </main>
                <SupportHotlineFab placement="right" />
            </div>
        </div>
    );
};

export default HelperLayout;
