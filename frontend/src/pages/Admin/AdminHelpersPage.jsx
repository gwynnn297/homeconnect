import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import './AdminHelpersPage.css';

const AdminHelpersPage = () => {
    const navigate = useNavigate();
    const [helpers, setHelpers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    
    // Filter & Pagination
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(10);
    const [sortBy, setSortBy] = useState('user.createdAt');
    const [sortDir, setSortDir] = useState('desc');
    
    // Pagination info
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Fetch helpers
    const fetchHelpers = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                size,
                sortBy,
                sortDir
            };
            if (status) {
                params.status = status;
            }
            const response = await AdminService.getHelpers(params);
            setHelpers(response.helpers || []);
            setTotalPages(response.totalPages || 0);
            setTotalElements(response.totalElements || 0);
        } catch (err) {
            setToast({
                type: 'error',
                message: err.message || 'Lỗi khi tải danh sách Helper'
            });
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHelpers();
    }, [page, size, status, sortBy, sortDir]);

    const handleViewDetail = (helperId) => {
        navigate(`/admin/helpers/${helperId}`);
    };

    const getStatusBadgeClass = (kycStatus) => {
        switch (kycStatus) {
            case 'PENDING':
                return 'status-pending';
            case 'WAITING_APPROVAL':
                return 'status-waiting';
            case 'IDENTITY_VERIFIED':
                return 'status-ai-verified';
            case 'VERIFIED':
                return 'status-verified';
            case 'REJECTED':
                return 'status-rejected';
            default:
                return '';
        }
    };

    const getStatusLabel = (kycStatus) => {
        switch (kycStatus) {
            case 'PENDING':
                return 'Chưa nộp';
            case 'WAITING_APPROVAL':
                return 'Chờ duyệt';
            case 'IDENTITY_VERIFIED':
                return 'AI Verified';
            case 'VERIFIED':
                return 'Đã xác minh';
            case 'REJECTED':
                return 'Bị từ chối';
            default:
                return kycStatus;
        }
    };

    return (
        <AdminLayout>
            <div className="admin-helpers-main">
                {toast && (
                    <NotificationModal
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
                <div className="page-header">
                    <h1>Quản lý Helper</h1>
                    <p>Tổng: {totalElements} Helper</p>
                </div>

                {/* Filter Section */}
                <div className="filter-section">
                    <div className="filter-group">
                        <label>Trạng thái KYC</label>
                        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
                            <option value="">-- Tất cả --</option>
                            <option value="PENDING">Chưa nộp</option>
                            <option value="WAITING_APPROVAL">Chờ duyệt</option>
                            <option value="IDENTITY_VERIFIED">AI Verified</option>
                            <option value="VERIFIED">Đã xác minh</option>
                            <option value="REJECTED">Bị từ chối</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Sắp xếp theo</label>
                        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(0); }}>
                            <option value="user.createdAt">Ngày tạo</option>
                            <option value="user.fullName">Tên Helper</option>
                            <option value="updatedAt">Ngày cập nhật</option>
                            <option value="kycStatus">Trạng thái KYC</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Hướng sắp xếp</label>
                        <select value={sortDir} onChange={(e) => { setSortDir(e.target.value); setPage(0); }}>
                            <option value="desc">Mới nhất</option>
                            <option value="asc">Cũ nhất</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Số lượng/trang</label>
                        <select value={size} onChange={(e) => { setSize(parseInt(e.target.value)); setPage(0); }}>
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                        </select>
                    </div>
                </div>

                {/* Loading */}
                {loading && <p className="text-center">Đang tải dữ liệu...</p>}

                {/* Helpers Table */}
                {!loading && helpers.length > 0 && (
                    <div className="helpers-table-wrapper">
                        <table className="helpers-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Tên</th>
                                    <th>Email</th>
                                    <th>Điện thoại</th>
                                    <th>Thành phố</th>
                                    <th>Trạng thái KYC</th>
                                    <th>Năm kinh nghiệm</th>
                                    <th>Dịch vụ</th>
                                    <th>Khu vực</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {helpers.map((helper) => (
                                    <tr key={helper.helperId}>
                                        <td>{helper.helperId}</td>
                                        <td className="name-cell">
                                            {helper.avatarUrl && (
                                                <img src={helper.avatarUrl} alt={helper.fullName} className="helper-avatar" />
                                            )}
                                            <div className="name-cell-meta">
                                                <span>{helper.fullName}</span>
                                                {helper.aiVerified && (
                                                    <span className="ai-verified-pill">✓ AI Verified</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>{helper.email}</td>
                                        <td>{helper.phone}</td>
                                        <td>{helper.currentCityName}</td>
                                        <td>
                                            <span className={`status-badge ${getStatusBadgeClass(helper.kycStatus)}`}>
                                                {getStatusLabel(helper.kycStatus)}
                                            </span>
                                        </td>
                                        <td>{helper.experienceYears} năm</td>
                                        <td>{helper.totalServices} dịch vụ</td>
                                        <td>{helper.totalWorkingDistricts} khu vực</td>
                                        <td>
                                            <button 
                                                className="btn-view-detail"
                                                onClick={() => handleViewDetail(helper.helperId)}
                                            >
                                                Chi tiết
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* No Data */}
                {!loading && helpers.length === 0 && (
                    <div className="no-data">
                        <p>Không có Helper nào</p>
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="pagination">
                        <button 
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                        >
                            ← Trước
                        </button>
                        <span className="page-info">
                            Trang {page + 1} / {totalPages}
                        </span>
                        <button 
                            disabled={page === totalPages - 1}
                            onClick={() => setPage(page + 1)}
                        >
                            Tiếp →
                        </button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminHelpersPage;
