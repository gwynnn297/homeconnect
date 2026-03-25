import React, { useState } from 'react';
import HelperLayout from '../../layouts/HelperLayout';
import NotificationModal from '../../components/NotificationModal';
import './HelperNewJobPage.css';

const MOCK_JOBS = [
    {
        id: 'JOB-94827',
        customerName: 'Trần Thị Mai',
        customerAvatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
        customerRating: '4.8',
        serviceName: 'Dọn dẹp nhà cửa',
        price: '200,000 đ',
        duration: '2 giờ',
        date: '28/03/2026',
        startTime: '08:00 - 10:00',
        address: '45 Lê Duẩn, P. Hải Châu 1, Q. Hải Châu, TP. Đà Nẵng',
        distance: '1.2 km',
        description: 'Nhà chung cư (70m2), chủ yếu dọn dẹp phòng khách, bếp và lau kính ban công. Gia đình không nuôi thú cưng. Vui lòng mang đồ nghề cơ bản như khăn lau, nước tẩy rửa nhẹ.',
        postedAt: '5 phút trước'
    },
    {
        id: 'JOB-94828',
        customerName: 'Lê Văn Hùng',
        customerAvatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
        customerRating: '5.0',
        serviceName: 'Sửa chữa điện nước',
        price: '350,000 đ',
        duration: 'Dự kiến 1 - 2 giờ',
        date: '30/03/2026',
        startTime: '10:30',
        address: '112 Trần Phú, P. Phước Ninh, Q. Hải Châu, TP. Đà Nẵng',
        distance: '3.5 km',
        description: 'Ống nước bồn rửa bát bị rỉ sét và rò rỉ nước ngầm, làm ướt tủ bếp dưới. Cần thợ chuyên môn kiểm tra, thay thế đường ống hoặc siết cứng lại. Giá báo có thể thương lượng thêm tuỳ vật tư thay thế.',
        postedAt: '15 phút trước'
    },
    {
        id: 'JOB-94829',
        customerName: 'Phạm Thu Trang',
        customerAvatar: 'https://i.pravatar.cc/150?u=a04258114e29026702d',
        customerRating: '4.9',
        serviceName: 'Trông trẻ',
        price: '500,000 đ',
        duration: '4 giờ (18:00 - 22:00)',
        date: '26/03/2026',
        startTime: '18:00',
        address: 'Khu biệt thự Đảo Xanh, P. Hòa Cường Bắc, Q. Hải Châu, TP. Đà Nẵng',
        distance: '5.0 km',
        description: 'Cần người có kinh nghiệm trông một bé gái 3 tuổi. Cho bé ăn nhẹ (đồ ăn đã chuẩn bị sẵn) và chơi cùng bé, đọc truyện trước khi ngủ trong khi ba mẹ đi sự kiện. Bé rất ngoan và dễ gần.',
        postedAt: '1 giờ trước'
    },
    {
        id: 'JOB-94830',
        customerName: 'Đinh Tuấn Anh',
        customerAvatar: 'https://i.pravatar.cc/150?u=a042581f4e29026701d',
        customerRating: '4.7',
        serviceName: 'Vệ sinh máy lạnh',
        price: '250,000 đ',
        duration: '1.5 giờ',
        date: '27/03/2026',
        startTime: '09:00',
        address: '89 Nguyễn Văn Thoại, P. An Hải Đông, Q. Sơn Trà, TP. Đà Nẵng',
        distance: '6.2 km',
        description: 'Vệ sinh 2 máy lạnh treo tường (1 HP). Máy hoạt động bình thường nhưng hơi ồn và yếu lạnh do lâu ngày không vệ sinh. Máy vị trí thấp dễ tháo lắp.',
        postedAt: '2 giờ trước'
    },
    {
        id: 'JOB-94831',
        customerName: 'Nguyễn Kiều Oanh',
        customerAvatar: 'https://i.pravatar.cc/150?u=a048581f4e29026701d',
        customerRating: '4.6',
        serviceName: 'Nấu ăn gia đình',
        price: '250,000 đ',
        duration: '2.5 giờ',
        date: '28/03/2026',
        startTime: '16:30',
        address: '56 Hoàng Diệu, P. Phước Ninh, Q. Hải Châu, TP. Đà Nẵng',
        distance: '2.0 km',
        description: 'Nấu ăn tối cho mâm 4 người lớn 1 trẻ em (các món Việt Nam), đi chợ mua đồ giùm (tiền chợ tính riêng), không ăn cay, không thích hải sản.',
        postedAt: '3 giờ trước'
    },
    {
        id: 'JOB-94832',
        customerName: 'Bùi Đức Mạnh',
        customerAvatar: 'https://i.pravatar.cc/150?u=a042581f4e29026601d',
        customerRating: '5.0',
        serviceName: 'Chuyển nhà trọn gói',
        price: '800,000 đ',
        duration: 'Cả ngày (Từ 08:30)',
        date: '31/03/2026',
        startTime: '08:30 - 17:00',
        address: 'Tòa nhà The Monarchy, Trần Hưng Đạo, Q. Sơn Trà, TP. Đà Nẵng',
        distance: '4.3 km',
        description: 'Phụ giúp đội thợ chuyển nhà: khuân vác, sắp xếp đóng thùng carton đồ linh tinh và tháo lắp bộ giường tủ, có người chở xe tải riêng.',
        postedAt: '5 giờ trước'
    }
];

const HelperNewJobPage = () => {
    const [jobs, setJobs] = useState(MOCK_JOBS);
    const [selectedJob, setSelectedJob] = useState(null);
    const [toast, setToast] = useState(null);
    const [loadingApply, setLoadingApply] = useState(false);

    const handleViewJob = (job) => {
        setSelectedJob(job);
    };

    const handleCloseModal = () => {
        if (!loadingApply) {
            setSelectedJob(null);
        }
    };

    const handleApplyJob = () => {
        setLoadingApply(true);
        // Giả lập call API Ứng tuyển
        setTimeout(() => {
            setLoadingApply(false);
            setToast({
                message: `Bạn đã ứng tuyển thành công công việc: ${selectedJob.serviceName}! Vui lòng chờ khách hàng xác nhận.`,
                type: 'success'
            });
            // Xoá job khỏi danh sách nếu ứng tuyển thành công
            setJobs(prevJobs => prevJobs.filter(j => j.id !== selectedJob.id));
            setSelectedJob(null);
        }, 1200);
    };

    return (
        <HelperLayout>
            <div className="hnj-page-container">
                {toast && (
                    <NotificationModal 
                        message={toast.message} 
                        type={toast.type} 
                        onClose={() => setToast(null)} 
                    />
                )}

                <div className="hnj-header">
                    <div>
                        <h1 className="hnj-title">Việc làm mới</h1>
                        <p className="hnj-subtitle">Khám phá và nhận ngay các công việc phù hợp với bạn quanh khu vực</p>
                    </div>
                    <div className="hnj-filters">
                        <button className="hnj-filter-btn">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                            Bộ lọc
                        </button>
                    </div>
                </div>

                <div className="hnj-grid">
                    {jobs.map((job) => (
                        <div key={job.id} className="hnj-card" onClick={() => handleViewJob(job)}>
                            <div className="hnj-card-top">
                                <div className="hnj-customer-info">
                                    <img src={job.customerAvatar} alt={job.customerName} className="hnj-avatar" />
                                    <div className="hnj-customer-details">
                                        <h3 className="hnj-customer-name">{job.customerName}</h3>
                                        <span className="hnj-posted-time">{job.postedAt}</span>
                                    </div>
                                </div>
                                <div className="hnj-price-badge">{job.price}</div>
                            </div>
                            
                            <div className="hnj-card-body">
                                <span className="hnj-service-tag">{job.serviceName}</span>
                                
                                <div className="hnj-info-row">
                                    <svg className="hnj-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <span>{job.date} &bull; {job.startTime}</span>
                                </div>
                                
                                <div className="hnj-info-row">
                                    <svg className="hnj-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                    <span className="hnj-address-text" title={job.address}>{job.address}</span>
                                </div>
                            </div>

                            <div className="hnj-card-footer">
                                <div className="hnj-distance">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 11 21 11"></polyline>
                                        <polyline points="10 4 3 11 10 18"></polyline>
                                    </svg>
                                    Cách {job.distance}
                                </div>
                                <button className="hnj-view-btn">
                                    Xem chi tiết
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14"></path>
                                        <path d="M12 5l7 7-7 7"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}

                    {jobs.length === 0 && (
                        <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#64748b'}}>
                            <h3>Chưa có công việc mới nào</h3>
                            <p>Không có công việc nào khả dụng quanh khu vực của bạn lúc này.</p>
                        </div>
                    )}
                </div>

                {/* MODAL VIEW DETAILED JOB */}
                {selectedJob && (
                    <div className="hnj-modal-overlay" onMouseDown={handleCloseModal}>
                        <div className="hnj-modal-content" onMouseDown={(e) => e.stopPropagation()}>
                            <div className="hnj-modal-header">
                                <h2 className="hnj-job-main-title">Chi tiết công việc</h2>
                                <button className="hnj-modal-close" onClick={handleCloseModal} disabled={loadingApply}>
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>

                            <div className="hnj-modal-body">
                                <div className="hnj-customer-profile">
                                    <img src={selectedJob.customerAvatar} alt={selectedJob.customerName} className="hnj-cp-avatar" />
                                    <div className="hnj-cp-info">
                                        <h4>{selectedJob.customerName}</h4>
                                        <div className="hnj-cp-rating">
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none">
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                            </svg>
                                            {selectedJob.customerRating} / 5.0
                                        </div>
                                    </div>
                                </div>

                                <div className="hnj-job-overview">
                                    <span className="hnj-service-tag" style={{ fontSize: '15px', marginBottom: 0 }}>
                                        {selectedJob.serviceName} &bull; {selectedJob.id}
                                    </span>
                                    <div className="hnj-price-badge" style={{ fontSize: '18px' }}>
                                        {selectedJob.price}
                                    </div>
                                </div>

                                <div className="hnj-detail-section">
                                    <div className="hnj-detail-grid">
                                        <div className="hnj-detail-item">
                                            <span className="hnj-detail-label">Ngày làm việc</span>
                                            <span className="hnj-detail-value">{selectedJob.date}</span>
                                        </div>
                                        <div className="hnj-detail-item">
                                            <span className="hnj-detail-label">Thời gian làm việc</span>
                                            <span className="hnj-detail-value">{selectedJob.startTime} ({selectedJob.duration})</span>
                                        </div>
                                    </div>
                                    <div className="hnj-detail-item" style={{ marginTop: '16px' }}>
                                        <span className="hnj-detail-label">Địa điểm làm việc</span>
                                        <span className="hnj-detail-value">{selectedJob.address}</span>
                                    </div>
                                    <div className="hnj-detail-item" style={{ marginTop: '16px' }}>
                                        <span className="hnj-detail-label">Khoảng cách</span>
                                        <span className="hnj-detail-value">Cách bạn khoảng {selectedJob.distance}</span>
                                    </div>
                                </div>

                                <div className="hnj-desc-box">
                                    <h3 className="hnj-desc-title">Mô tả công việc & Yêu cầu</h3>
                                    <div className="hnj-desc-text">
                                        {selectedJob.description}
                                    </div>
                                </div>
                            </div>

                            <div className="hnj-modal-footer">
                                <button className="hnj-btn-cancel" onClick={handleCloseModal} disabled={loadingApply}>
                                    Đóng
                                </button>
                                <button className="hnj-btn-apply" onClick={handleApplyJob} disabled={loadingApply}>
                                    {loadingApply ? (
                                        <>
                                            <div className="hnj-spinner"></div>
                                            Đang ứng tuyển...
                                        </>
                                    ) : (
                                        <>
                                            Ứng tuyển ngay
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </HelperLayout>
    );
};

export default HelperNewJobPage;
