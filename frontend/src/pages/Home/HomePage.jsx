import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';
import logoHomieConnect from '../../assets/LogoHomieConnect.png';

const HomePage = () => {
    const navigate = useNavigate();

    const handleLogin = () => {
        navigate('/login');
    };

    const handleRegister = () => {
        navigate('/register');
    };
    const handleHome = () => {
        navigate("/home");
    };
    return (
        <div className="home-container">
            {/* Header */}
            <header className="hp-header">
                <div className="hp-logo" onClick={handleHome}>
                    <img className="hp-logo-img" src={logoHomieConnect} alt="HomieConnectLogo" />
                </div>
                <nav className="hp-nav">
                    <a href="#services">Dịch vụ</a>
                    <a href="#how-it-works">Cách hoạt động</a>
                    <a href="#contact">Liên hệ</a>
                </nav>
                <div className="hp-header-buttons">
                    <button className="hp-btn-login" onClick={handleLogin}>
                        Đăng nhập
                    </button>
                    <button className="hp-btn-register" onClick={handleRegister}>
                        Đăng kí
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <h1>Kết nối yêu thương, sẻ chia công việc</h1>
                    <p>
                        Homie Connect giúp bạn kết nối người giúp việc uy tín và nhanh chóng ngay tại khu vực của bạn
                    </p>
                    <button className="btn-start" onClick={handleRegister}>
                        Tìm kiếm dịch vụ ngay
                    </button>

                    <div className="hero-features">
                        <div className="hero-feature">
                            <span className="feature-icon">✓</span>
                            <span>Đội ngũ uy tín</span>
                        </div>
                        <div className="hero-feature">
                            <span className="feature-icon">✓</span>
                            <span>Giá cả minh bạch</span>
                        </div>
                        <div className="hero-feature">
                            <span className="feature-icon">✓</span>
                            <span>Hỗ trợ tận tâm</span>
                        </div>
                    </div>
                </div>
                <div className="hero-image">
                    <div className="mockup">
                        <div className="mockup-header">
                            <h3>Tìm kiếm dịch vụ dễ dàng</h3>
                        </div>
                        <div className="mockup-content">
                            <div className="service-list">
                                <div className="service-item">Bạn có hài lòng với dịch vụ?</div>
                                <div className="service-item">Bạn có muốn giới thiệu cho người khác?</div>
                                <div className="service-item">Điểm đánh giá từ 1-10?</div>
                            </div>
                            <div className="stats">
                                <div className="stat-item">
                                    <span className="stat-number">5,200+</span>
                                    <span className="stat-label">Người dùng</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-number">98%</span>
                                    <span className="stat-label">Hài lòng</span>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: '98%' }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services Section */}
            <section id="services" className="services-section">
                <h2>Dịch vụ của chúng tôi</h2>
                <div className="service-cards">
                    <div className="service-card">
                        <div className="service-icon">🧹</div>
                        <h3>Dọn dẹp nhà cửa</h3>
                        <p>Dịch vụ dọn dẹp chuyên nghiệp, tận tâm</p>
                        <ul className="service-features">
                            <li>Dọn dẹp toàn bộ nhà cửa</li>
                            <li>Vệ sinh cao cấp</li>
                            <li>Nhân viên được đào tạo</li>
                        </ul>
                    </div>
                    <div className="service-card">
                        <div className="service-icon">📚</div>
                        <h3>Giúp việc tại nhà</h3>
                        <p>Tìm người giúp việc uy tín, chuyên nghiệp</p>
                        <ul className="service-features">
                            <li>Kinh nghiệm lâu năm</li>
                            <li>Đã được xác minh</li>
                            <li>Hỗ trợ 24/7</li>
                        </ul>
                    </div>
                    <div className="service-card">
                        <div className="service-icon">🍳</div>
                        <h3>Dịch vụ nấu ăn</h3>
                        <p>Thợ nấu ăn chuyên nghiệp, đảm bảo vệ sinh và ngon miệng</p>
                        <ul className="service-features">
                            <li>Menu đa dạng</li>
                            <li>Nguyên liệu tươi sạch</li>
                            <li>Linh hoạt theo yêu cầu</li>
                        </ul>
                    </div>
                </div>
            </section>


            {/* How it works */}
            <section id="how-it-works" className="how-it-works">
                <h2>Hoạt động như thế nào?</h2>
                <div className="steps">
                    <div className="step">
                        <div className="step-number">1</div>
                        <h3>Tìm kiếm & Đặt lịch</h3>
                        <p>Lựa chọn dịch vụ và thời gian phù hợp với nhu cầu của bạn</p>
                    </div>
                    <div className="step">
                        <div className="step-number">2</div>
                        <h3>Chọn người giúp việc</h3>
                        <p>Lựa chọn người giúp việc phù hợp với nhu cầu của bạn</p>
                    </div>
                    <div className="step">
                        <div className="step-number">3</div>
                        <h3>Thanh toán & Đánh giá</h3>
                        <p>Thanh toán an toàn và đánh giá chất lượng dịch vụ</p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="cta-content">
                    <h2>Bạn cần hỗ trợ ngay hôm nay?</h2>
                    <p>Hãy để Homie Connect giúp cuộc sống của bạn trở nên dễ dàng hơn.</p>
                    <div className="cta-buttons">
                        <button className="btn-trial" onClick={handleRegister}>
                            Đăng ký ngay
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="footer-content">
                    <div className="footer-left">
                        <div className="footer-logo">
                            <span className="logo-text-footer">HomieConnect</span>
                        </div>
                        <p>Nền tảng kết nối dịch vụ tiện ích cho mọi nhà.</p>
                    </div>
                    <div className="footer-right">
                        <div className="footer-links">
                            <h4>Liên kết</h4>
                            <a href="#services">Dịch vụ</a>
                            <a href="#how-it-works">Cách hoạt động</a>
                        </div>
                        <div className="footer-links">
                            <h4>Hỗ trợ</h4>
                            <a href="#contact">Liên hệ</a>
                            <a href="#faq">Câu hỏi thường gặp</a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>© 2026 Homie Connect. Tất cả quyền được bảo lưu.</p>
                </div>
            </footer>
        </div>
    );
};

export default HomePage;