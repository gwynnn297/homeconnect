import React, { useState, useEffect } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import './CustomerManagePostsPage.css';

// Dữ liệu giả lập khớp với cấu trúc database của bạn
const MOCK_DB_POSTS = [
    {
        post_id: 1,
        customer_id: 10,
        service_id: 1,
        title: "Cần người dọn nhà buổi sáng",
        description: "Dọn nhà 2 phòng ngủ, lau sàn, rửa chén và dọn sơ phòng khách.",
        address_detail: "Richemont Vietnam, 11 Đ. Lê Lợi, Bến Nghé, Quận 1, TP. HCM",
        created_at: "2026-03-24T08:30:00Z",
        status: "PENDING",
        estimated_price: 150000
    },
    {
        post_id: 5,
        customer_id: 10,
        service_id: 1,
        title: "Cần người dọn nhà buổi sáng",
        description: "Dọn nhà 2 phòng ngủ, lau sàn, rửa chén và dọn khu vực bếp.",
        address_detail: "Đông Trà 2, Hòa Hải, Ngũ Hành Sơn, Đà Nẵng",
        created_at: "2026-03-23T14:15:00Z",
        status: "MATCHED",
        estimated_price: 200000
    },
    {
        post_id: 8,
        customer_id: 10,
        service_id: 1,
        title: "Cần người dọn dẹp nhà cửa",
        description: "Lau dọn phòng ngủ, phòng khách, ban công.",
        address_detail: "196 Nguyễn Phước Nguyên, Thanh Khê Đông, Đà Nẵng",
        created_at: "2026-03-22T09:00:00Z",
        status: "COMPLETED",
        estimated_price: 180000
    }
];

const SERVICE_INFOS = {
    1: { name: 'Dọn dẹp nhà cửa', icon: '🏡', color: '#4CAF50' },
    2: { name: 'Nấu ăn', icon: '🍳', color: '#FF9800' },
    3: { name: 'Đi chợ', icon: '🛒', color: '#9C27B0' },
    //... (các dịch vụ khác tương tự)
};

const CustomerManagePostsPage = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Giả lập gọi API (delay 800ms) để lấy dữ liệu từ Backend
        const fetchPosts = () => {
            setTimeout(() => {
                setPosts(MOCK_DB_POSTS);
                setLoading(false);
            }, 800);
        };
        fetchPosts();
    }, []);

    const formatCurrency = (val) => {
        if (!val) return '0 ₫';
        return val.toLocaleString('vi-VN') + ' ₫';
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'PENDING':
                return { label: 'Đang tìm người', color: '#FF9800', bg: '#FFF3E0' };
            case 'MATCHED':
                return { label: 'Đã nhận việc', color: '#2196F3', bg: '#E3F2FD' };
            case 'COMPLETED':
                return { label: 'Đã hoàn thành', color: '#4CAF50', bg: '#E8F5E9' };
            default:
                return { label: status, color: '#757575', bg: '#F5F5F5' };
        }
    };

    return (
        <CustomerLayout>
            <div className="cmp-container slide-up">
                <div className="cmp-header">
                    <h1 className="cmp-title">Quản lý bài đăng</h1>
                    <p className="cmp-subtitle">Xem và theo dõi trạng thái các yêu cầu dịch vụ bạn đã đăng.</p>
                </div>

                <div className="cmp-content">
                    {loading ? (
                        <div className="cmp-loading-wrapper">
                            <div className="cmp-spinner"></div>
                            <p>Đang tải dữ liệu bài đăng...</p>
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="cmp-empty-state">
                            <div className="cmp-empty-icon">📝</div>
                            <h3>Bạn chưa có bài đăng nào</h3>
                            <p>Hãy đặt dịch vụ để trải nghiệm tiện ích tuyệt vời của chúng tôi nhé!</p>
                        </div>
                    ) : (
                        <div className="cmp-post-grid">
                            {posts.map(post => {
                                const service = SERVICE_INFOS[post.service_id] || { name: 'Dịch vụ', icon: '✨', color: '#666' };
                                const statusConf = getStatusConfig(post.status);

                                return (
                                    <div key={post.post_id} className="cmp-post-card">
                                        <div className="cmp-post-card-header" style={{ borderBottomColor: `${service.color}30` }}>
                                            <div className="cmp-service-badge" style={{ color: service.color, backgroundColor: `${service.color}15` }}>
                                                <span className="cmp-icon">{service.icon}</span>
                                                {service.name}
                                            </div>
                                            <div className="cmp-status-badge" style={{ color: statusConf.color, backgroundColor: statusConf.bg }}>
                                                {statusConf.label}
                                            </div>
                                        </div>

                                        <div className="cmp-post-card-body">
                                            <h3 className="cmp-post-title">{post.title}</h3>
                                            <p className="cmp-post-desc">{post.description}</p>
                                            
                                            <div className="cmp-post-info-row">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                    <circle cx="12" cy="10" r="3" />
                                                </svg>
                                                <span>{post.address_detail}</span>
                                            </div>

                                            <div className="cmp-post-info-row">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="12 6 12 12 16 14" />
                                                </svg>
                                                <span>Ngày đăng: {new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            <div className="cmp-post-price">
                                                Giá dự kiến: <strong>{formatCurrency(post.estimated_price)}</strong>
                                            </div>
                                        </div>

                                        <div className="cmp-post-card-footer">
                                            <button className="cmp-btn-outline" style={{ borderColor: service.color, color: service.color }}>
                                                Xem chi tiết
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </CustomerLayout>
    );
};

export default CustomerManagePostsPage;
