import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import ServiceManagerService from '../../services/ServiceManagerService';
import './ServiceManagerPage.css';

const UNIT_OPTIONS = [
    { value: 'PER_HOUR', label: 'Theo giờ' },
    { value: 'PER_SERVICE', label: 'Theo dịch vụ' },
    { value: 'PER_METERS', label: 'Theo m²' },
    { value: 'PER_ROOM', label: 'Theo phòng' },
];

const EMPTY_CAT_FORM = { name: '', description: '', basePrice: '', unit: 'PER_SERVICE', isActive: true };
const EMPTY_SVC_FORM = { name: '', description: '', basePrice: '', unit: 'PER_HOUR', categoryId: '', isActive: true };

const formatMoney = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
    return Number(value).toLocaleString('vi-VN');
};

const normalizeCat = (c) => ({
    categoryId: c?.categoryId ?? c?.category_id ?? c?.id ?? null,
    name: c?.name ?? '',
    description: c?.description ?? '',
    basePrice: c?.basePrice ?? c?.base_price ?? 0,
    unit: c?.unit ?? null,
    isActive: c?.isActive ?? c?.is_active ?? true,
});

const normalizeSvc = (s) => ({
    serviceId: s?.serviceId ?? s?.service_id ?? s?.id ?? null,
    name: s?.name ?? '',
    description: s?.description ?? '',
    basePrice: s?.basePrice ?? s?.base_price ?? 0,
    unit: s?.unit ?? 'PER_HOUR',
    isActive: s?.isActive ?? s?.is_active ?? false,
    categoryId: s?.categoryId ?? s?.category_id ?? null,
});

const ServiceManagerPage = () => {
    const [activeTab, setActiveTab] = useState('categories');
    const [toast, setToast] = useState(null);

    // ── Danh mục cha state ───────────────────────────────────────────
    const [categories, setCategories] = useState([]);
    const [catLoading, setCatLoading] = useState(false);
    const [catSubmitting, setCatSubmitting] = useState(false);
    const [editingCatId, setEditingCatId] = useState(null);
    const [catForm, setCatForm] = useState(EMPTY_CAT_FORM);

    // ── Dịch vụ con state ────────────────────────────────────────────
    const [selectedCatId, setSelectedCatId] = useState('');
    const [services, setServices] = useState([]);
    const [svcLoading, setSvcLoading] = useState(false);
    const [svcSubmitting, setSvcSubmitting] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [svcForm, setSvcForm] = useState(EMPTY_SVC_FORM);

    const isEditCat = editingCatId !== null;
    const isEditSvc = editingServiceId !== null;

    const showNotification = (type, message) => setToast({ type, message });

    // ── Load danh mục ────────────────────────────────────────────────
    // Admin API: GET /api/v1/admin/categories/parents
    // apiClient interceptor trả về: { message, data: [CategoryResponse] }
    const loadCategories = useCallback(async () => {
        setCatLoading(true);
        try {
            const res = await ServiceManagerService.getParentCategories();
            const list = res?.data ?? res;
            const arr = Array.isArray(list) ? list : [];
            setCategories(arr.map(normalizeCat));
        } catch (err) {
            console.error('loadCategories error:', err);
            showNotification('error', err?.message || 'Không thể tải danh mục');
        } finally {
            setCatLoading(false);
        }
    }, []);

    useEffect(() => { loadCategories(); }, [loadCategories]);

    // ── Load dịch vụ theo danh mục ───────────────────────────────────
    const loadServices = useCallback(async (catId) => {
        if (!catId) { setServices([]); return; }
        setSvcLoading(true);
        try {
            const res = await ServiceManagerService.getServicesByCategory(catId);
            const list = res?.data ?? res ?? [];
            setServices(Array.isArray(list) ? list.map(normalizeSvc) : []);
        } catch (err) {
            showNotification('error', err?.message || 'Không thể tải dịch vụ');
            setServices([]);
        } finally {
            setSvcLoading(false);
        }
    }, []);

    useEffect(() => { loadServices(selectedCatId); }, [selectedCatId, loadServices]);

    // ── Category CRUD ────────────────────────────────────────────────
    const resetCatForm = () => { setEditingCatId(null); setCatForm(EMPTY_CAT_FORM); };

    const handleCatChange = (field, value) =>
        setCatForm((prev) => ({ ...prev, [field]: value }));

    const handleEditCat = (cat) => {
        setEditingCatId(cat.categoryId);
        setCatForm({
            name: cat.name || '',
            description: cat.description || '',
            basePrice: cat.basePrice?.toString() || '',
            unit: cat.unit || 'PER_SERVICE',
            isActive: Boolean(cat.isActive),
        });
    };

    const handleSubmitCat = async (e) => {
        e.preventDefault();
        if (!catForm.name.trim()) { showNotification('warning', 'Vui lòng nhập tên danh mục'); return; }
        const payload = {
            name: catForm.name.trim(),
            description: catForm.description.trim() || null,
            basePrice: catForm.basePrice !== '' ? Number(catForm.basePrice) : null,
            unit: catForm.unit || null,
            isActive: catForm.isActive,
        };
        setCatSubmitting(true);
        try {
            if (isEditCat) {
                const res = await ServiceManagerService.updateCategory(editingCatId, payload);
                const updated = normalizeCat(res?.data ?? res);
                setCategories((prev) => prev.map((c) => c.categoryId === updated.categoryId ? updated : c));
                showNotification('success', 'Cập nhật danh mục thành công');
            } else {
                const res = await ServiceManagerService.createCategory(payload);
                const created = normalizeCat(res?.data ?? res);
                setCategories((prev) => [...prev, created]);
                showNotification('success', 'Tạo danh mục thành công');
            }
            resetCatForm();
        } catch (err) {
            showNotification('error', err?.message || 'Thao tác thất bại');
        } finally {
            setCatSubmitting(false);
        }
    };

    const handleDeleteCat = async (cat) => {
        if (!window.confirm(`Xóa danh mục "${cat.name}"?\nLưu ý: Tất cả dịch vụ con bên trong cũng sẽ bị xóa.`)) return;
        try {
            await ServiceManagerService.deleteCategory(cat.categoryId);
            setCategories((prev) => prev.filter((c) => c.categoryId !== cat.categoryId));
            if (Number(selectedCatId) === cat.categoryId) { setSelectedCatId(''); setServices([]); }
            if (editingCatId === cat.categoryId) resetCatForm();
            showNotification('success', 'Xóa danh mục thành công');
        } catch (err) {
            showNotification('error', err?.message || 'Không thể xóa danh mục');
        }
    };

    // ── Service CRUD ─────────────────────────────────────────────────
    const resetSvcForm = (categoryId = selectedCatId || '') => {
        setEditingServiceId(null);
        setSvcForm({ ...EMPTY_SVC_FORM, categoryId });
    };

    const handleSvcChange = (field, value) =>
        setSvcForm((prev) => ({ ...prev, [field]: field === 'isActive' ? Boolean(value) : value }));

    const handleEditSvc = (svc) => {
        setEditingServiceId(svc.serviceId);
        setSvcForm({
            name: svc.name || '',
            description: svc.description || '',
            basePrice: svc.basePrice?.toString() || '',
            unit: svc.unit || 'PER_HOUR',
            categoryId: svc.categoryId || selectedCatId || '',
            isActive: Boolean(svc.isActive),
        });
    };

    const handleSubmitSvc = async (e) => {
        e.preventDefault();
        if (!svcForm.name.trim()) { showNotification('warning', 'Vui lòng nhập tên dịch vụ'); return; }
        if (!svcForm.categoryId) { showNotification('warning', 'Vui lòng chọn danh mục'); return; }
        if (svcForm.basePrice === '' || Number.isNaN(Number(svcForm.basePrice))) {
            showNotification('warning', 'Vui lòng nhập giá hợp lệ'); return;
        }
        const payload = {
            name: svcForm.name.trim(),
            description: svcForm.description.trim() || null,
            base_price: Number(svcForm.basePrice),
            unit: svcForm.unit,
            category_id: Number(svcForm.categoryId),
            is_active: svcForm.isActive,
        };
        setSvcSubmitting(true);
        try {
            if (isEditSvc) {
                const res = await ServiceManagerService.updateService(editingServiceId, payload);
                const updated = normalizeSvc(res?.data ?? res);
                setServices((prev) => prev.map((s) => s.serviceId === updated.serviceId ? updated : s));
                showNotification('success', 'Cập nhật dịch vụ thành công');
            } else {
                const res = await ServiceManagerService.createService(payload);
                const created = normalizeSvc(res?.data ?? res);
                if (!selectedCatId || Number(selectedCatId) === payload.category_id) {
                    setServices((prev) =>
                        [...prev, created].sort((a, b) => (a.serviceId || 0) - (b.serviceId || 0))
                    );
                }
                showNotification('success', 'Tạo dịch vụ thành công');
            }
            resetSvcForm();
        } catch (err) {
            showNotification('error', err?.message || 'Thao tác thất bại');
        } finally {
            setSvcSubmitting(false);
        }
    };

    const handleDeleteSvc = async (svc) => {
        if (!window.confirm(`Bạn có chắc muốn xóa dịch vụ "${svc.name}"?`)) return;
        try {
            await ServiceManagerService.deleteService(svc.serviceId);
            setServices((prev) => prev.filter((s) => s.serviceId !== svc.serviceId));
            if (editingServiceId === svc.serviceId) resetSvcForm();
            showNotification('success', 'Xóa dịch vụ thành công');
        } catch (err) {
            showNotification('error', err?.message || 'Không thể xóa dịch vụ');
        }
    };

    const selectedCatName = categories.find((c) => c.categoryId === Number(selectedCatId))?.name;

    return (
        <AdminLayout>
            <div className="service-manager-page">
                <div className="page-header">
                    <div>
                        <h1>Quản lý dịch vụ</h1>
                        <p className="text-muted">
                            {categories.length} danh mục
                            {selectedCatId && ` · ${services.length} dịch vụ trong "${selectedCatName}"`}
                        </p>
                    </div>
                </div>

                {toast && (
                    <NotificationModal
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}

                {/* ── Tab bar ─────────────────────────────────────────── */}
                <div className="smp-tabs">
                    <button
                        type="button"
                        className={`smp-tab ${activeTab === 'categories' ? 'active' : ''}`}
                        onClick={() => setActiveTab('categories')}
                    >
                        Danh mục
                        <span className="smp-tab-badge">{categories.length}</span>
                    </button>
                    <button
                        type="button"
                        className={`smp-tab ${activeTab === 'services' ? 'active' : ''}`}
                        onClick={() => setActiveTab('services')}
                    >
                        Dịch vụ con
                        {selectedCatId && (
                            <span className="smp-tab-badge">{services.length}</span>
                        )}
                    </button>
                </div>

                {/* ══════════════════════════════════════════════════════
                    Tab: Danh mục cha
                ══════════════════════════════════════════════════════ */}
                {activeTab === 'categories' && (
                    <div className="service-manager-grid">
                        {/* Danh sách danh mục */}
                        <section className="service-list-card">
                            <div className="card-header">
                                <h2>Danh sách danh mục</h2>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={loadCategories}
                                    disabled={catLoading}
                                >
                                    {catLoading ? 'Đang tải...' : 'Làm mới'}
                                </button>
                            </div>

                            {catLoading ? (
                                <p className="text-muted">Đang tải dữ liệu...</p>
                            ) : categories.length === 0 ? (
                                <div className="empty-hint">
                                    <span>📂</span>
                                    <p>Chưa có danh mục nào. Hãy tạo danh mục đầu tiên bằng form bên phải.</p>
                                </div>
                            ) : (
                                <div className="table-wrapper">
                                    <table className="service-table">
                                        <thead>
                                            <tr>
                                                <th>Tên danh mục</th>
                                                <th>Đơn vị</th>
                                                <th>Giá cơ bản</th>
                                                <th>Trạng thái</th>
                                                <th className="action-col">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categories.map((cat, idx) => (
                                                <tr
                                                    key={cat.categoryId ?? `cat-${idx}`}
                                                    className={editingCatId === cat.categoryId ? 'row-editing' : ''}
                                                >
                                                    <td>
                                                        <div className="service-name-cell">
                                                            <div>
                                                                <div className="cell-name">{cat.name}</div>
                                                                {cat.description && (
                                                                    <div className="cell-sub">{cat.description}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{cat.unit ?? '—'}</td>
                                                    <td>
                                                        {cat.basePrice
                                                            ? `${formatMoney(cat.basePrice)} VNĐ`
                                                            : '—'}
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${cat.isActive ? 'active' : 'inactive'}`}>
                                                            {cat.isActive ? 'Hoạt động' : 'Đã tắt'}
                                                        </span>
                                                    </td>
                                                    <td className="action-col">
                                                        <div className="row-actions">
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-green"
                                                                title="Xem dịch vụ con của danh mục này"
                                                                onClick={() => {
                                                                    setSelectedCatId(cat.categoryId);
                                                                    resetSvcForm(cat.categoryId);
                                                                    setActiveTab('services');
                                                                }}
                                                            >
                                                                Dịch vụ
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary"
                                                                onClick={() => handleEditCat(cat)}
                                                            >
                                                                Sửa
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-danger"
                                                                onClick={() => handleDeleteCat(cat)}
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

                        {/* Form danh mục */}
                        <section className="service-form-card">
                            <div className="card-header">
                                <h2>
                                    {isEditCat ? `Sửa danh mục #${editingCatId}` : 'Tạo danh mục mới'}
                                </h2>
                                {isEditCat && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={resetCatForm}
                                        disabled={catSubmitting}
                                    >
                                        Hủy
                                    </button>
                                )}
                            </div>

                            <form className="service-form" onSubmit={handleSubmitCat}>
                                <div className="form-group">
                                    <label>Tên danh mục *</label>
                                    <input
                                        type="text"
                                        value={catForm.name}
                                        onChange={(e) => handleCatChange('name', e.target.value)}
                                        placeholder="Ví dụ: Dịch vụ Gia đình"
                                        maxLength={100}
                                        disabled={catSubmitting}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Giá cơ bản (VNĐ)</label>
                                    <input
                                        type="number"
                                        value={catForm.basePrice}
                                        onChange={(e) => handleCatChange('basePrice', e.target.value)}
                                        placeholder="Ví dụ: 50000"
                                        disabled={catSubmitting}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Đơn vị tính</label>
                                    <select
                                        value={catForm.unit}
                                        onChange={(e) => handleCatChange('unit', e.target.value)}
                                        disabled={catSubmitting}
                                    >
                                        {UNIT_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Mô tả</label>
                                    <textarea
                                        rows={3}
                                        value={catForm.description}
                                        onChange={(e) => handleCatChange('description', e.target.value)}
                                        placeholder="Mô tả ngắn về danh mục dịch vụ"
                                        disabled={catSubmitting}
                                    />
                                </div>

                                <div className="form-group checkbox-row">
                                    <input
                                        id="catIsActive"
                                        type="checkbox"
                                        checked={catForm.isActive}
                                        onChange={(e) => handleCatChange('isActive', e.target.checked)}
                                        disabled={catSubmitting}
                                    />
                                    <label htmlFor="catIsActive">Kích hoạt dịch vụ</label>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={catSubmitting}
                                >
                                    {catSubmitting
                                        ? 'Đang xử lý...'
                                        : isEditCat ? 'Lưu cập nhật' : 'Tạo danh mục'}
                                </button>
                            </form>
                        </section>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════
                    Tab: Dịch vụ con
                ══════════════════════════════════════════════════════ */}
                {activeTab === 'services' && (
                    <>
                        {/* Bộ lọc danh mục */}
                        <div className="smp-filter-bar">
                            <div className="smp-filter-left">
                                <label className="filter-label">Danh mục:</label>
                                <select
                                    className="filter-select"
                                    value={selectedCatId}
                                    onChange={(e) => {
                                        const nextCatId = e.target.value ? Number(e.target.value) : '';
                                        setSelectedCatId(nextCatId);
                                        resetSvcForm(nextCatId);
                                    }}
                                >
                                    <option value="">— Chọn danh mục —</option>
                                    {categories.map((cat) => (
                                        <option key={cat.categoryId} value={cat.categoryId}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {selectedCatId && (
                                <button
                                    type="button"
                                    className="btn btn-secondary smp-filter-refresh"
                                    onClick={() => loadServices(selectedCatId)}
                                    disabled={svcLoading}
                                >
                                    {svcLoading ? 'Đang tải...' : 'Làm mới'}
                                </button>
                            )}
                        </div>

                        <div className="service-manager-grid">
                            {/* Danh sách dịch vụ */}
                            <section className="service-list-card">
                                <div className="card-header">
                                    <h2>
                                        {selectedCatName
                                            ? `Dịch vụ – ${selectedCatName}`
                                            : 'Dịch vụ con'}
                                    </h2>
                                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                        {selectedCatId ? `${services.length} dịch vụ` : ''}
                                    </span>
                                </div>

                                {!selectedCatId ? (
                                    <div className="empty-hint">
                                        <p>Chọn một danh mục để xem và quản lý dịch vụ con</p>
                                    </div>
                                ) : svcLoading ? (
                                    <p className="text-muted">Đang tải dữ liệu...</p>
                                ) : services.length === 0 ? (
                                    <div className="empty-hint">
                                        <p>Danh mục này chưa có dịch vụ con nào</p>
                                    </div>
                                ) : (
                                    <div className="table-wrapper">
                                        <table className="service-table">
                                            <thead>
                                                <tr>
                                                    <th>Tên dịch vụ</th>
                                                    <th>Đơn vị</th>
                                                    <th>Giá cơ bản</th>
                                                    <th>Trạng thái</th>
                                                    <th className="action-col">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {services.map((svc, idx) => (
                                                    <tr
                                                        key={svc.serviceId ?? `svc-${idx}`}
                                                        className={editingServiceId === svc.serviceId ? 'row-editing' : ''}
                                                    >
                                                        <td>
                                                            <div className="service-name-cell">
                                                                <div>
                                                                    <div className="cell-name">{svc.name}</div>
                                                                    {svc.description && (
                                                                        <div className="cell-sub">{svc.description}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>{svc.unit}</td>
                                                        <td>{formatMoney(svc.basePrice)} VNĐ</td>
                                                        <td>
                                                            <span className={`status-badge ${svc.isActive ? 'active' : 'inactive'}`}>
                                                                {svc.isActive ? 'Hoạt động' : 'Đã tắt'}
                                                            </span>
                                                        </td>
                                                        <td className="action-col">
                                                            <div className="row-actions">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary"
                                                                    onClick={() => handleEditSvc(svc)}
                                                                >
                                                                    Sửa
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-danger"
                                                                    onClick={() => handleDeleteSvc(svc)}
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

                            {/* Form dịch vụ */}
                            <section className="service-form-card">
                                <div className="card-header">
                                    <h2>
                                        {isEditSvc
                                            ? `Sửa dịch vụ #${editingServiceId}`
                                            : 'Tạo dịch vụ mới'}
                                    </h2>
                                    {isEditSvc && (
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={resetSvcForm}
                                            disabled={svcSubmitting}
                                        >
                                            Hủy
                                        </button>
                                    )}
                                </div>

                                <form className="service-form" onSubmit={handleSubmitSvc}>
                                    <div className="form-group">
                                        <label>Danh mục *</label>
                                        <select
                                            value={svcForm.categoryId}
                                            onChange={(e) => handleSvcChange('categoryId', e.target.value)}
                                            disabled={svcSubmitting}
                                        >
                                            <option value="">— Chọn danh mục —</option>
                                            {categories.map((cat) => (
                                                <option key={cat.categoryId} value={cat.categoryId}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Tên dịch vụ *</label>
                                        <input
                                            type="text"
                                            value={svcForm.name}
                                            onChange={(e) => handleSvcChange('name', e.target.value)}
                                            placeholder="Ví dụ: Dọn nhà theo giờ"
                                            maxLength={100}
                                            disabled={svcSubmitting}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Giá cơ bản (VNĐ) *</label>
                                        <input
                                            type="number"
                                            value={svcForm.basePrice}
                                            onChange={(e) => handleSvcChange('basePrice', e.target.value)}
                                            placeholder="80000"
                                            disabled={svcSubmitting}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Đơn vị tính *</label>
                                        <select
                                            value={svcForm.unit}
                                            onChange={(e) => handleSvcChange('unit', e.target.value)}
                                            disabled={svcSubmitting}
                                        >
                                            {UNIT_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Mô tả</label>
                                        <textarea
                                            rows={3}
                                            value={svcForm.description}
                                            onChange={(e) => handleSvcChange('description', e.target.value)}
                                            placeholder="Mô tả ngắn về dịch vụ"
                                            disabled={svcSubmitting}
                                        />
                                    </div>

                                    <div className="form-group checkbox-row">
                                        <input
                                            id="svcIsActive"
                                            type="checkbox"
                                            checked={svcForm.isActive}
                                            onChange={(e) => handleSvcChange('isActive', e.target.checked)}
                                            disabled={svcSubmitting}
                                        />
                                        <label htmlFor="svcIsActive">Kích hoạt dịch vụ</label>
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={svcSubmitting}
                                    >
                                        {svcSubmitting
                                            ? 'Đang xử lý...'
                                            : isEditSvc ? 'Lưu cập nhật' : 'Tạo dịch vụ'}
                                    </button>
                                </form>
                            </section>
                        </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
};

export default ServiceManagerPage;
