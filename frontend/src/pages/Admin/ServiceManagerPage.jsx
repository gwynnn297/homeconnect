import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import ServiceManagerService from '../../services/ServiceManagerService';
import HelperRegistrationService from '../../services/HelperRegistrationService';
import './ServiceManagerPage.css';

const UNIT_OPTIONS = [
    { value: 'PER_HOUR', label: 'Theo giờ' },
    { value: 'PER_SERVICE', label: 'Theo dịch vụ' },
    { value: 'PER_METERS', label: 'Theo m2' },
    { value: 'PER_ROOM', label: 'Theo phòng' }
];

const EMPTY_FORM = {
    name: '',
    description: '',
    basePrice: '',
    unit: 'PER_HOUR',
    isActive: true
};

const normalizeService = (service) => ({
    serviceId: service?.serviceId ?? service?.service_id ?? service?.id ?? null,
    name: service?.name ?? '',
    description: service?.description ?? '',
    iconUrl: service?.iconUrl ?? service?.icon_url ?? service?.icon ?? '',
    basePrice: service?.basePrice ?? service?.base_price ?? 0,
    unit: service?.unit ?? 'PER_HOUR',
    isActive: service?.isActive ?? service?.is_active ?? false,
    createdAt: service?.createdAt ?? service?.created_at ?? null,
    updatedAt: service?.updatedAt ?? service?.updated_at ?? null
});

const formatMoney = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return '0';
    }
    return Number(value).toLocaleString('vi-VN');
};

const ServiceManagerPage = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);

    const [editingServiceId, setEditingServiceId] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const isEditMode = useMemo(() => editingServiceId !== null, [editingServiceId]);
    const showNotification = (type, message) => {
        setToast({ type, message });
    };

    const upsertService = (list, service) => {
        if (!service || service.serviceId === null || service.serviceId === undefined) return list;
        const idx = list.findIndex((item) => item.serviceId === service.serviceId);
        if (idx === -1) {
            return [...list, service].sort((a, b) => (a.serviceId || 0) - (b.serviceId || 0));
        }
        const next = [...list];
        next[idx] = { ...next[idx], ...service };
        return next.sort((a, b) => (a.serviceId || 0) - (b.serviceId || 0));
    };

    const loadServices = async () => {
        setLoading(true);
        try {
            const serviceMap = new Map();

            const basicServices = await HelperRegistrationService.getServices();
            const detailResponses = await Promise.all(
                (basicServices || []).map(async (item) => {
                    const itemId = item?.id ?? item?.serviceId ?? item?.service_id;
                    if (!itemId) return null;
                    try {
                        const detail = await ServiceManagerService.getServiceDetail(itemId);
                        return normalizeService(detail?.data ?? detail);
                    } catch {
                        return normalizeService(item);
                    }
                })
            );

            detailResponses.forEach((item) => {
                if (item && item.serviceId !== null && item.serviceId !== undefined) {
                    serviceMap.set(item.serviceId, item);
                }
            });

            // Endpoint public chỉ trả dịch vụ active.
            // Dùng totalServices từ admin statistics để quét thêm các dịch vụ inactive.
            let totalServices = null;
            try {
                const stats = await AdminService.getStatistics();
                totalServices = stats?.systemStats?.totalServices ?? null;
            } catch {
                totalServices = null;
            }

            if (totalServices && serviceMap.size < totalServices) {
                const knownIds = Array.from(serviceMap.keys()).filter((id) => Number.isInteger(id));
                const maxKnownId = knownIds.length > 0 ? Math.max(...knownIds) : 0;
                const maxScanId = Math.max(maxKnownId + 80, totalServices * 4, 120);

                let nextId = 1;
                let consecutiveMisses = 0;
                const maxConsecutiveMisses = 40;
                const batchSize = 10;

                while (
                    serviceMap.size < totalServices &&
                    nextId <= maxScanId &&
                    consecutiveMisses < maxConsecutiveMisses
                ) {
                    const batchIds = [];
                    while (batchIds.length < batchSize && nextId <= maxScanId) {
                        if (!serviceMap.has(nextId)) {
                            batchIds.push(nextId);
                        }
                        nextId += 1;
                    }

                    const batchResults = await Promise.all(
                        batchIds.map(async (id) => {
                            try {
                                const detail = await ServiceManagerService.getServiceDetail(id);
                                return normalizeService(detail?.data ?? detail);
                            } catch {
                                return null;
                            }
                        })
                    );

                    let foundInBatch = 0;
                    batchResults.forEach((item) => {
                        if (item && item.serviceId !== null && item.serviceId !== undefined) {
                            serviceMap.set(item.serviceId, item);
                            foundInBatch += 1;
                        }
                    });

                    consecutiveMisses = foundInBatch === 0
                        ? consecutiveMisses + batchIds.length
                        : 0;
                }
            }

            const normalized = Array.from(serviceMap.values())
                .filter((item) => item && item.serviceId !== null && item.serviceId !== undefined)
                .sort((a, b) => (a.serviceId || 0) - (b.serviceId || 0));

            setServices(normalized);
        } catch (err) {
            showNotification('error', err?.message || 'Không thể tải danh sách dịch vụ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadServices();
    }, []);

    const resetForm = () => {
        setEditingServiceId(null);
        setFormData(EMPTY_FORM);
    };

    const handleChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: field === 'isActive' ? Boolean(value) : value
        }));
    };

    const handleEdit = (service) => {
        setEditingServiceId(service.serviceId);
        setFormData({
            name: service.name || '',
            description: service.description || '',
            basePrice: service.basePrice?.toString?.() || '',
            unit: service.unit || 'PER_HOUR',
            isActive: Boolean(service.isActive)
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            showNotification('warning', 'Vui lòng nhập tên dịch vụ');
            return;
        }
        if (formData.basePrice === '' || Number.isNaN(Number(formData.basePrice))) {
            showNotification('warning', 'Vui lòng nhập giá hợp lệ');
            return;
        }

        const payload = {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            base_price: Number(formData.basePrice),
            unit: formData.unit,
            is_active: formData.isActive
        };

        setSubmitting(true);
        try {
            if (isEditMode) {
                const updatedResponse = await ServiceManagerService.updateService(editingServiceId, payload);
                const updatedService = normalizeService(updatedResponse?.data ?? updatedResponse);
                setServices((prev) => upsertService(prev, updatedService));
                showNotification('success', 'Cập nhật dịch vụ thành công');
            } else {
                const createdResponse = await ServiceManagerService.createService(payload);
                const createdService = normalizeService(createdResponse?.data ?? createdResponse);
                setServices((prev) => upsertService(prev, createdService));
                showNotification('success', 'Tạo dịch vụ mới thành công');
            }
            resetForm();
        } catch (err) {
            showNotification('error', err?.message || 'Thao tác thất bại, vui lòng thử lại');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (service) => {
        const confirmed = window.confirm(`Bạn có chắc muốn xóa dịch vụ "${service.name}"?`);
        if (!confirmed) return;

        try {
            await ServiceManagerService.deleteService(service.serviceId);
            setServices((prev) => prev.filter((item) => item.serviceId !== service.serviceId));
            showNotification('success', 'Xóa dịch vụ thành công');
            if (editingServiceId === service.serviceId) {
                resetForm();
            }
        } catch (err) {
            showNotification('error', err?.message || 'Không thể xóa dịch vụ');
        }
    };

    return (
        <AdminLayout>
            <div className="service-manager-page">
                <div className="page-header">
                    <h1>Quản lý dịch vụ</h1>
                    <p>Tổng: {services.length} dịch vụ</p>
                </div>

                {toast && (
                    <NotificationModal
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}

                <div className="service-manager-grid">
                    <section className="service-list-card">
                        <div className="card-header">
                            <h2>Danh sách dịch vụ</h2>
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={loadServices}
                                disabled={loading}
                            >
                                {loading ? 'Đang tải...' : 'Làm mới'}
                            </button>
                        </div>

                        {loading ? (
                            <p className="text-muted">Đang tải dữ liệu...</p>
                        ) : services.length === 0 ? (
                            <p className="text-muted">Chưa có dịch vụ nào</p>
                        ) : (
                            <div className="table-wrapper">
                                <table className="service-table">
                                    <thead>
                                        <tr>
                                            <th>Tên dịch vụ</th>
                                            <th>Đơn vị</th>
                                            <th>Giá cơ bản</th>
                                            <th>Trạng thái</th>
                                            <th>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {services.map((service, index) => (
                                            <tr key={service?.serviceId ?? `${service?.name ?? 'service'}-${index}`}>
                                                <td>
                                                    <div className="service-name-cell">
                                                        <span>{service.name}</span>
                                                    </div>
                                                </td>
                                                <td>{service.unit}</td>
                                                <td>{formatMoney(service.basePrice)} VNĐ</td>
                                                <td>
                                                    <span className={`status-badge ${service.isActive ? 'active' : 'inactive'}`}>
                                                        {service.isActive ? 'Đang hoạt động' : 'Đã tắt'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary"
                                                            onClick={() => handleEdit(service)}
                                                        >
                                                            Sửa
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-danger"
                                                            onClick={() => handleDelete(service)}
                                                        >
                                                            Xóa
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="service-form-card">
                        <div className="card-header">
                            <h2>{isEditMode ? `Cập nhật dịch vụ #${editingServiceId}` : 'Tạo dịch vụ mới'}</h2>
                            {isEditMode && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={resetForm}
                                    disabled={submitting}
                                >
                                    Hủy sửa
                                </button>
                            )}
                        </div>

                        <form className="service-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Tên dịch vụ *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                    placeholder="Ví dụ: Dọn nhà theo giờ"
                                    maxLength={100}
                                    disabled={submitting}
                                />
                            </div>

                            <div className="form-group">
                                <label>Giá cơ bản (VNĐ) *</label>
                                <input
                                    type="number"
                                    value={formData.basePrice}
                                    onChange={(e) => handleChange('basePrice', e.target.value)}
                                    step="any"
                                    placeholder="80000"
                                    disabled={submitting}
                                />
                            </div>

                            <div className="form-group">
                                <label>Đơn vị tính *</label>
                                <select
                                    value={formData.unit}
                                    onChange={(e) => handleChange('unit', e.target.value)}
                                    disabled={submitting}
                                >
                                    {UNIT_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label} ({option.value})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Mô tả</label>
                                <textarea
                                    rows={4}
                                    value={formData.description}
                                    onChange={(e) => handleChange('description', e.target.value)}
                                    placeholder="Mô tả ngắn về dịch vụ"
                                    disabled={submitting}
                                />
                            </div>

                            <div className="form-group checkbox-row">
                                <input
                                    id="isActive"
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => handleChange('isActive', e.target.checked)}
                                    disabled={submitting}
                                />
                                <label htmlFor="isActive">Kích hoạt dịch vụ</label>
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting
                                    ? 'Đang xử lý...'
                                    : isEditMode
                                        ? 'Lưu cập nhật'
                                        : 'Tạo dịch vụ'}
                            </button>
                        </form>
                    </section>
                </div>
            </div>
        </AdminLayout>
    );
};

export default ServiceManagerPage;
