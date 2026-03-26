import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import apiClient from '../../services/apiClient';
import './CustomerPostDetailPage.css';

const formatCurrency = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return '0 ₫';
    return n.toLocaleString('vi-VN') + ' ₫';
};

const formatDate = (val) => {
    if (!val) return '---';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '---';
    return d.toLocaleDateString('vi-VN');
};

const getStatusConfig = (status) => {
    switch (status) {
        case 'PUBLISHED':
        case 'PENDING':
            return { label: 'Đang tìm người', color: '#B56A00', bg: '#FEF3C7' };
        case 'ASSIGNED':
        case 'MATCHED':
        case 'CONFIRMED':
            return { label: 'Đã nhận việc', color: '#2196F3', bg: '#E3F2FD' };
        case 'COMPLETED':
            return { label: 'Đã hoàn thành', color: '#16A34A', bg: '#DCFCE7' };
        case 'CANCELLED':
            return { label: 'Đã hủy', color: '#E74C3C', bg: '#FEE2E2' };
        case 'EXPIRED':
            return { label: 'Hết hạn', color: '#6B7280', bg: '#F3F4F6' };
        default:
            return { label: status || '---', color: '#6B7280', bg: '#F3F4F6' };
    }
};

const CustomerPostDetailPage = () => {
    const navigate = useNavigate();
    const { postId } = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await apiClient.get(`/api/v1/jobs/${postId}`);
                const job = res?.data ?? res;
                setData(job || null);
            } catch (err) {
                setData(null);
                setError(err?.message || 'Không thể tải chi tiết bài đăng.');
            } finally {
                setLoading(false);
            }
        };

        if (!postId) {
            setLoading(false);
            setError('Thiếu mã bài đăng.');
            return;
        }
        load();
    }, [postId]);

    const viewModel = useMemo(() => {
        const job = data || {};
        const addressText = [job?.addressDetail, job?.wardName, job?.districtName, job?.provinceName]
            .filter(Boolean)
            .join(', ');

        return {
            postId: job?.postId ?? '',
            title: job?.title || `Bài đăng #${job?.postId ?? ''}`,
            categoryName: job?.categoryName || 'Dịch vụ',
            serviceNames: job?.serviceNames || '',
            description: job?.description || '',
            status: job?.status || '---',
            createdAt: job?.createdAt,
            workDate: job?.workDate,
            startTime: job?.startTime,
            durationHours: job?.durationHours,
            offerPrice: job?.offerPrice,
            addressText: addressText || '---',
            isPremium: Boolean(job?.isPremium),
            hasPets: Boolean(job?.hasPets),
            bringTools: Boolean(job?.bringTools),
            workSize: job?.workSize
        };
    }, [data]);

    const statusConf = getStatusConfig(viewModel.status);

    return (
        <CustomerLayout>
            <div className="cpd-container slide-up">
                <div className="cpd-header">
                    <button className="cpd-back" type="button" onClick={() => navigate(-1)}>
                        ← Quay lại
                    </button>
                    <div className="cpd-header-main">
                        <h1 className="cpd-title">Chi tiết bài đăng</h1>
                        <div className="cpd-sub">
                            <span className="cpd-chip">{viewModel.categoryName}</span>
                            <span className="cpd-status" style={{ color: statusConf.color, background: statusConf.bg }}>
                                {statusConf.label}
                            </span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="cpd-card">
                        <div className="cpd-loading">Đang tải chi tiết...</div>
                    </div>
                ) : error ? (
                    <div className="cpd-card cpd-error">
                        <h3>Không tải được chi tiết</h3>
                        <p>{error}</p>
                        <button className="cpd-primary" type="button" onClick={() => navigate('/customer/manage-posts')}>
                            Về quản lý bài đăng
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="cpd-grid">
                            <div className="cpd-card">
                                <div className="cpd-section">
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Mã bài đăng</div>
                                        <div className="cpd-v">#{viewModel.postId}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Tiêu đề</div>
                                        <div className="cpd-v">{viewModel.title}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Ngày đăng</div>
                                        <div className="cpd-v">{formatDate(viewModel.createdAt)}</div>
                                    </div>
                                </div>

                                <div className="cpd-divider" />

                                <div className="cpd-section">
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Địa chỉ</div>
                                        <div className="cpd-v">{viewModel.addressText}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Ngày làm</div>
                                        <div className="cpd-v">{viewModel.workDate || '---'}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Giờ bắt đầu</div>
                                        <div className="cpd-v">{viewModel.startTime || '---'}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Thời lượng</div>
                                        <div className="cpd-v">{viewModel.durationHours ? `${viewModel.durationHours} giờ` : '---'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="cpd-card">
                                <div className="cpd-section">
                                    <div className="cpd-price-label">Giá đề xuất</div>
                                    <div className="cpd-price">{formatCurrency(viewModel.offerPrice)}</div>
                                    <div className="cpd-meta">
                                        {viewModel.isPremium && <span className="cpd-pill">Premium</span>}
                                        {viewModel.hasPets && <span className="cpd-pill">Có thú cưng</span>}
                                        {viewModel.bringTools && <span className="cpd-pill">Cần mang dụng cụ</span>}
                                        {viewModel.workSize ? <span className="cpd-pill">Diện tích: {viewModel.workSize}</span> : null}
                                    </div>
                                </div>

                                <div className="cpd-divider" />

                                <div className="cpd-section">
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Dịch vụ con</div>
                                        <div className="cpd-v">{viewModel.serviceNames || '---'}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Ghi chú</div>
                                        <div className="cpd-v">{viewModel.description || '---'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="cpd-actions">
                            <button className="cpd-secondary" type="button" onClick={() => navigate('/customer/manage-posts')}>
                                Danh sách bài đăng
                            </button>
                        </div>
                    </>
                )}
            </div>
        </CustomerLayout>
    );
};

export default CustomerPostDetailPage;

