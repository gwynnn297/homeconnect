import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import ProfileService from '../../services/ProfileService';
import CustomerLayout from '../../layouts/CustomerLayout';
import './CustomerPostJobPage.css';

const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const DEFAULT_LATITUDE = 10.762622;
const DEFAULT_LONGITUDE = 106.660172;

const THEME_PRIMARY = '#2F5D50';
const SERVICE_INFOS = {
    1: { name: 'Dọn dẹp nhà cửa', icon: '🏠', color: THEME_PRIMARY },
    2: { name: 'Nấu ăn', icon: '🍳', color: THEME_PRIMARY },
    3: { name: 'Đi chợ', icon: '🛍️', color: THEME_PRIMARY },
    4: { name: 'Vệ sinh văn phòng', icon: '🏢', color: THEME_PRIMARY },
    5: { name: 'Trông trẻ', icon: '👶', color: THEME_PRIMARY },
    6: { name: 'Làm vườn', icon: '🌿', color: THEME_PRIMARY },
    7: { name: 'Sơn sửa', icon: '🔨', color: THEME_PRIMARY },
};

const CustomerPostJobPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const categoryId = parseInt(searchParams.get('serviceId'), 10) || 1;
    const [categoryName, setCategoryName] = useState('');

    const [step, setStep] = useState(1);

    const [jobData, setJobData] = useState({
        categoryId,
        serviceIds: [],
        addressId: null,
        addressDetail: '',
        workDate: '',
        startTime: '',
        durationHours: 2,
        title: '',
        description: ''
    });

    const [estimateData, setEstimateData] = useState(null);
    const [loadingEstimate, setLoadingEstimate] = useState(false);
    const [loadingSubmit, setLoadingSubmit] = useState(false);

    const handleSelectAddress = (addressPayload) => {
        setJobData(prev => ({
            ...prev,
            addressId: addressPayload?.addressId ?? prev.addressId,
            addressDetail: addressPayload?.fullAddress || '',
        }));
        setStep(2);
    };

    const handleJobDetailsSubmit = (details, preCalculatedEstimate) => {
        const newData = { ...jobData, ...details };
        setJobData(newData);
        setEstimateData(preCalculatedEstimate);
        setStep(3);
    };

    const handleConfirmAndPay = async () => {
        try {
            setLoadingSubmit(true);
            const payload = {
                categoryId: jobData.categoryId,
                serviceIds: jobData.serviceIds,
                addressId: jobData.addressId,
                workDate: jobData.workDate,
                startTime: jobData.startTime,
                durationHours: jobData.durationHours,
                title: jobData.title,
                description: jobData.description
            };
            const res = await apiClient.post('/api/v1/jobs', payload);
            alert(res?.message || "Đăng tin thành công! Bạn có thể xem tin đã đăng ở phần Quản lý bài đăng.");
            navigate('/customer/manage-posts');
        } catch (error) {
            console.error("Error creating job", error);
            alert(error.message || "Có lỗi xảy ra khi thanh toán và đăng tin.");
        } finally {
            setLoadingSubmit(false);
        }
    };

    useEffect(() => {
        const loadCategoryName = async () => {
            try {
                const res = await ProfileService.getActiveCategories();
                const list = extractPayload(res);
                const matched = Array.isArray(list) ? list.find((item) => Number(item?.id) === categoryId) : null;
                setCategoryName(matched?.name || '');
            } catch {
                setCategoryName('');
            }
        };
        loadCategoryName();
    }, [categoryId]);

    const serviceInfo = SERVICE_INFOS[categoryId] || {
        name: categoryName || 'Dịch vụ',
        icon: '✨',
        color: '#2f4858'
    };

    return (
        <CustomerLayout>
            <div className="customer-post-job-page">
                {step === 1 && (
                    <AddressStep
                        onBack={() => navigate('/customer-dashboard')}
                        onSelectAddress={handleSelectAddress}
                        serviceInfo={serviceInfo}
                    />
                )}
                {step === 2 && (
                    <JobDetailsStep
                        onBack={() => setStep(1)}
                        onSubmit={handleJobDetailsSubmit}
                        initialData={jobData}
                        serviceInfo={serviceInfo}
                    />
                )}
                {step === 3 && (
                    <ConfirmPayStep
                        onBack={() => setStep(2)}
                        onConfirm={handleConfirmAndPay}
                        jobData={jobData}
                        estimateData={estimateData}
                        loadingEstimate={loadingEstimate}
                        loadingSubmit={loadingSubmit}
                        serviceInfo={serviceInfo}
                    />
                )}
            </div>
        </CustomerLayout>
    );
};

/* -------------------------------------------------------------------------- */
/* STEP 1: Address Step                                                       */
/* -------------------------------------------------------------------------- */
const AddressStep = ({ onBack, onSelectAddress, serviceInfo }) => {
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [savedError, setSavedError] = useState('');
    const [inUseAddressIds, setInUseAddressIds] = useState([]);

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoadingSuggest, setIsLoadingSuggest] = useState(false);
    const [suggestError, setSuggestError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [addressType, setAddressType] = useState('HOME');

    // ─── Edit/Delete saved addresses (frontend only) ─────────────────────
    const [editTargetAddress, setEditTargetAddress] = useState(null);
    const [editForm, setEditForm] = useState({
        addressDetail: '',
        wardName: '',
        districtName: '',
        provinceName: '',
        type: 'HOME',
        isDefault: false
    });
    const [editError, setEditError] = useState('');
    const [isUpdatingAddress, setIsUpdatingAddress] = useState(false);
    const [isDeletingAddress, setIsDeletingAddress] = useState(false);

    const debounceRef = useRef(null);
    const latestQueryRef = useRef('');

    const normalizedQuery = useMemo(() => String(query || '').trim(), [query]);

    const buildFullAddress = (addr) => {
        if (!addr) return '';
        const parts = [
            addr.addressDetail,
            addr.wardName,
            addr.districtName,
            addr.provinceName
        ].filter(Boolean);
        return parts.join(', ');
    };

    const parseDescriptionToSaveRequest = (description = '') => {
        const parts = String(description)
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);

        if (parts.length < 4) {
            return null;
        }

        const provinceName = parts[parts.length - 1];
        const districtName = parts[parts.length - 2];
        const wardName = parts[parts.length - 3];
        const addressDetail = parts.slice(0, parts.length - 3).join(', ');

        if (!addressDetail || !wardName || !districtName || !provinceName) {
            return null;
        }

        return { addressDetail, wardName, districtName, provinceName };
    };

    const loadSavedAddresses = async () => {
        try {
            setIsLoadingSaved(true);
            setSavedError('');
            const res = await apiClient.get('/api/v1/addresses');
            const list = extractPayload(res);
            setSavedAddresses(Array.isArray(list) ? list : []);
        } catch (err) {
            setSavedAddresses([]);
            setSavedError(err?.message || 'Không thể tải danh sách địa chỉ đã lưu.');
        } finally {
            setIsLoadingSaved(false);
        }
    };

    useEffect(() => {
        loadSavedAddresses();
    }, []);

    useEffect(() => {
        const loadInUseAddressIds = async () => {
            try {
                const res = await apiClient.get('/api/v1/jobs');
                const list = extractPayload(res);
                if (!Array.isArray(list)) {
                    setInUseAddressIds([]);
                    return;
                }
                const ids = Array.from(
                    new Set(
                        list
                            .map((j) => Number(j?.addressId))
                            .filter((id) => Number.isFinite(id) && id > 0)
                    )
                );
                setInUseAddressIds(ids);
            } catch {
                // Không chặn flow đăng tin nếu endpoint jobs đang lỗi.
                setInUseAddressIds([]);
            }
        };
        loadInUseAddressIds();
    }, []);

    const fetchSuggestions = async (input) => {
        if (!input || input.trim().length < 3) {
            setSuggestions([]);
            setSuggestError('');
            return;
        }
        try {
            setIsLoadingSuggest(true);
            setSuggestError('');
            const res = await apiClient.get('/api/v1/addresses/autocomplete', {
                params: { input }
            });
            const list = extractPayload(res);
            setSuggestions(Array.isArray(list) ? list : []);
        } catch (err) {
            setSuggestions([]);
            setSuggestError(err?.message || 'Không thể lấy gợi ý địa chỉ.');
        } finally {
            setIsLoadingSuggest(false);
        }
    };

    useEffect(() => {
        latestQueryRef.current = normalizedQuery;
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(latestQueryRef.current);
        }, 350);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [normalizedQuery]);

    const handlePickSaved = (addr) => {
        const fullAddress = buildFullAddress(addr);
        onSelectAddress({
            addressId: addr?.addressId ?? null,
            fullAddress,
            latitude: addr?.latitude ? Number(addr.latitude) : DEFAULT_LATITUDE,
            longitude: addr?.longitude ? Number(addr.longitude) : DEFAULT_LONGITUDE
        });
    };

    const handlePickSuggestion = async (s) => {
        const placeId = s?.place_id || s?.placeId;
        const description = s?.description || '';
        const parsed = parseDescriptionToSaveRequest(description);

        if (!placeId || !parsed) {
            setSuggestError('Địa chỉ gợi ý chưa đủ thông tin (cần tối thiểu: số nhà/đường, phường, quận, tỉnh). Vui lòng nhập chi tiết hơn.');
            return;
        }

        try {
            setIsSaving(true);
            setSuggestError('');
            const payload = {
                ...parsed,
                placeId,
                type: addressType,
                isDefault: false
            };
            const res = await apiClient.post('/api/v1/addresses', payload);
            const saved = extractPayload(res);
            setSavedAddresses((prev) => {
                const next = [saved, ...(Array.isArray(prev) ? prev : []).filter((a) => a?.addressId !== saved?.addressId)];
                return next;
            });

            const fullAddress = buildFullAddress(saved) || description;
            onSelectAddress({
                addressId: saved?.addressId ?? null,
                fullAddress,
                latitude: saved?.latitude ? Number(saved.latitude) : DEFAULT_LATITUDE,
                longitude: saved?.longitude ? Number(saved.longitude) : DEFAULT_LONGITUDE
            });
        } catch (err) {
            setSuggestError(err?.message || 'Không thể lưu địa chỉ. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    const sortedSavedAddresses = useMemo(() => {
        const arr = Array.isArray(savedAddresses) ? [...savedAddresses] : [];
        return arr.sort((a, b) => {
            const aDef = Boolean(a?.isDefault);
            const bDef = Boolean(b?.isDefault);
            if (aDef !== bDef) return aDef ? -1 : 1;
            const aHome = String(a?.type || '').toUpperCase() === 'HOME';
            const bHome = String(b?.type || '').toUpperCase() === 'HOME';
            if (aHome !== bHome) return aHome ? -1 : 1;
            return Number(b?.addressId ?? 0) - Number(a?.addressId ?? 0);
        });
    }, [savedAddresses]);

    const openEditAddress = (addr) => {
        if (!addr) return;
        setEditTargetAddress(addr);
        setEditError('');
        setEditForm({
            addressDetail: addr.addressDetail || '',
            wardName: addr.wardName || '',
            districtName: addr.districtName || '',
            provinceName: addr.provinceName || '',
            type: addr.type || 'HOME',
            isDefault: Boolean(addr.isDefault)
        });
    };

    const closeEditAddress = (force = false) => {
        if (!force && isUpdatingAddress) return; // tránh bấm đóng khi đang submit
        setEditTargetAddress(null);
        setEditError('');
    };

    const handleUpdateAddress = async () => {
        if (!editTargetAddress) return;

        const addressDetail = String(editForm.addressDetail || '').trim();
        const wardName = String(editForm.wardName || '').trim();
        const districtName = String(editForm.districtName || '').trim();
        const provinceName = String(editForm.provinceName || '').trim();

        if (!addressDetail || !wardName || !districtName || !provinceName) {
            setEditError('Vui lòng điền đầy đủ địa chỉ (Số nhà, Phường/Xã, Quận/Huyện, Tỉnh/Thành).');
            return;
        }

        try {
            setIsUpdatingAddress(true);
            setEditError('');

            const payload = {
                addressDetail,
                wardName,
                districtName,
                provinceName,
                type: editForm.type || 'HOME',
                isDefault: Boolean(editForm.isDefault)
            };

            await apiClient.put(`/api/v1/addresses/${editTargetAddress.addressId}`, payload);
            await loadSavedAddresses();
            closeEditAddress(true);
        } catch (err) {
            setEditError(err?.message || 'Không thể cập nhật địa chỉ. Vui lòng thử lại.');
        } finally {
            setIsUpdatingAddress(false);
        }
    };

    const handleDeleteAddress = async (addressId) => {
        if (!addressId) return;
        if (inUseAddressIds.includes(Number(addressId))) {
            setEditError('Không thể xóa địa chỉ này vì đang được dùng trong bài đăng hiện có.');
            return;
        }
        const ok = window.confirm('Bạn có chắc chắn muốn xóa địa chỉ này không?');
        if (!ok) return;

        try {
            setIsDeletingAddress(true);
            setSavedError('');
            setEditError('');

            await apiClient.delete(`/api/v1/addresses/${addressId}`);
            await loadSavedAddresses();

            // Nếu đang sửa đúng địa chỉ đó thì đóng modal
            setEditTargetAddress((prev) => (prev?.addressId === addressId ? null : prev));
        } catch (err) {
            setEditError(err?.message || 'Không thể xóa địa chỉ. Vui lòng thử lại.');
        } finally {
            setIsDeletingAddress(false);
        }
    };

    return (
        <div className="pj-card">
            <div className="pj-header" style={{ borderBottomColor: serviceInfo.color }}>
                <button className="pj-back-btn" onClick={onBack}>
                    ←
                </button>
                <div className="pj-header-title">
                    <span className="pj-icon">{serviceInfo.icon}</span>
                    Đăng tin {serviceInfo.name}
                </div>
                <div className="pj-step">Bước 1/3</div>
            </div>

            <div className="pj-body">
                <div className="pj-two-columns">
                    {/* Cột trái - Tìm kiếm địa chỉ mới */}
                    <div className="pj-column">
                        <div className="pj-section">
                            <h3 className="pj-section-title">Tìm địa chỉ mới</h3>

                            <div className="pj-form-group">
                                <label className="pj-label">Địa chỉ thi công</label>
                                <input
                                    type="text"
                                    className="pj-input"
                                    placeholder="Nhập số nhà, đường, phường, quận, thành phố..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                />
                                {isLoadingSuggest && <div className="pj-hint">Đang tìm kiếm...</div>}
                            </div>

                            <div className="pj-form-group">
                                <label className="pj-label">Loại địa chỉ</label>
                                <select
                                    className="pj-select"
                                    value={addressType}
                                    onChange={(e) => setAddressType(e.target.value)}
                                    disabled={isSaving}
                                >
                                    <option value="HOME">🏠 Nhà riêng</option>
                                    <option value="OFFICE">🏢 Văn phòng</option>
                                    <option value="OTHER">📍 Khác</option>
                                </select>
                            </div>

                            {suggestError && (
                                <div className="pj-error">{suggestError}</div>
                            )}

                            {suggestions.length > 0 && (
                                <div className="pj-suggestions">
                                    <div className="pj-suggestions-header">📍 Kết quả gợi ý</div>
                                    {suggestions.map((sug) => (
                                        <button
                                            type="button"
                                            key={sug.place_id || sug.placeId || sug.description}
                                            className="pj-suggestion-item"
                                            onClick={() => handlePickSuggestion(sug)}
                                            disabled={isSaving}
                                        >
                                            <div className="pj-suggestion-title">{sug.description}</div>
                                            <div className="pj-suggestion-action">
                                                {isSaving ? 'Đang lưu...' : 'Chọn'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {!isLoadingSuggest && normalizedQuery.length >= 3 && suggestions.length === 0 && !suggestError && (
                                <div className="pj-hint">
                                    Không tìm thấy địa chỉ phù hợp. Vui lòng nhập chi tiết hơn (phường, quận, thành phố).
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cột phải - Địa chỉ đã lưu */}
                    <div className="pj-column">
                        <div className="pj-section">
                            <div className="pj-section-header">
                                <h3 className="pj-section-title">📌 Địa chỉ đã lưu</h3>
                                <span className="pj-count">{savedAddresses.length}</span>
                            </div>

                            <div className="pj-address-list">
                                {isLoadingSaved && (
                                    <div className="pj-hint">Đang tải địa chỉ...</div>
                                )}

                                {!isLoadingSaved && savedError && (
                                    <div className="pj-error">{savedError}</div>
                                )}

                                {!isLoadingSaved && !savedError && savedAddresses.length === 0 && (
                                    <div className="pj-empty">
                                        <p>📭 Chưa có địa chỉ nào được lưu</p>
                                        <small>Hãy tìm kiếm và thêm địa chỉ mới</small>
                                    </div>
                                )}

                                {!isLoadingSaved && !savedError && savedAddresses.length > 0 && (
                                    <>
                                        {sortedSavedAddresses.map(addr => (
                                            (() => {
                                                const isInUse = inUseAddressIds.includes(Number(addr?.addressId));
                                                return (
                                                    <div
                                                        className="pj-address-item"
                                                        key={addr.addressId}
                                                        onClick={() => handlePickSaved(addr)}
                                                    >
                                                        <div className="pj-address-icon">
                                                            {String(addr.type || '').toUpperCase() === 'HOME' ? '🏠' :
                                                                String(addr.type || '').toUpperCase() === 'OFFICE' ? '🏢' : '📍'}
                                                        </div>
                                                        <div className="pj-address-info">
                                                            <div className="pj-address-name">
                                                                {String(addr.type || '').toUpperCase() === 'HOME'
                                                                    ? 'Nhà riêng'
                                                                    : String(addr.type || '').toUpperCase() === 'OFFICE'
                                                                        ? 'Văn phòng'
                                                                        : 'Địa chỉ khác'}
                                                                {addr.isDefault && <span className="pj-badge">Mặc định</span>}
                                                                {isInUse && <span className="pj-badge pj-badge-inuse">Đang dùng</span>}
                                                            </div>
                                                            <div className="pj-address-detail">{buildFullAddress(addr)}</div>
                                                        </div>
                                                        <div
                                                            className="pj-address-actions"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                type="button"
                                                                className="pj-address-action-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openEditAddress(addr);
                                                                }}
                                                                disabled={isUpdatingAddress || isDeletingAddress}
                                                            >
                                                                ✏️ Sửa
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="pj-address-action-btn pj-address-action-delete"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteAddress(addr.addressId);
                                                                }}
                                                                disabled={isUpdatingAddress || isDeletingAddress || isInUse}
                                                            >
                                                                🗑️ Xóa
                                                            </button>
                                                        </div>
                                                        <div className="pj-address-arrow">→</div>
                                                    </div>
                                                );
                                            })()
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {editTargetAddress && (
                <div className="pj-modal-backdrop" onClick={closeEditAddress} role="dialog" aria-modal="true">
                    <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="pj-modal-header">
                            <h3 className="pj-modal-title">Sửa địa chỉ</h3>
                            <button
                                type="button"
                                className="pj-modal-close"
                                onClick={closeEditAddress}
                                disabled={isUpdatingAddress}
                            >
                                ✕
                            </button>
                        </div>

                        {editError && <div className="pj-error">{editError}</div>}

                        <div className="pj-modal-body">
                            <div className="pj-form-group">
                                <label className="pj-label">Số nhà, tên đường *</label>
                                <input
                                    className="pj-input"
                                    value={editForm.addressDetail}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, addressDetail: e.target.value }))}
                                    disabled={isUpdatingAddress}
                                />
                            </div>

                            <div className="pj-form-row">
                                <div className="pj-form-group half">
                                    <label className="pj-label">Phường/Xã *</label>
                                    <input
                                        className="pj-input"
                                        value={editForm.wardName}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, wardName: e.target.value }))}
                                        disabled={isUpdatingAddress}
                                    />
                                </div>

                                <div className="pj-form-group half">
                                    <label className="pj-label">Quận/Huyện *</label>
                                    <input
                                        className="pj-input"
                                        value={editForm.districtName}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, districtName: e.target.value }))}
                                        disabled={isUpdatingAddress}
                                    />
                                </div>
                            </div>

                            <div className="pj-form-group">
                                <label className="pj-label">Tỉnh/Thành phố *</label>
                                <input
                                    className="pj-input"
                                    value={editForm.provinceName}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, provinceName: e.target.value }))}
                                    disabled={isUpdatingAddress}
                                />
                            </div>

                            <div className="pj-form-row">
                                <div className="pj-form-group half">
                                    <label className="pj-label">Loại địa chỉ</label>
                                    <select
                                        className="pj-select"
                                        value={editForm.type}
                                        onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value }))}
                                        disabled={isUpdatingAddress}
                                    >
                                        <option value="HOME">🏠 Nhà riêng</option>
                                        <option value="OFFICE">🏢 Văn phòng</option>
                                        <option value="OTHER">📍 Khác</option>
                                    </select>
                                </div>

                                <div className="pj-form-group half" style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <label className="pj-label" style={{ marginBottom: 0 }}>
                                        Địa chỉ mặc định
                                    </label>
                                    <div style={{ marginLeft: 12 }}>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(editForm.isDefault)}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                                            disabled={isUpdatingAddress}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pj-actions">
                            <button
                                type="button"
                                className="pj-btn-primary pj-btn-secondary"
                                onClick={closeEditAddress}
                                disabled={isUpdatingAddress}
                                style={{ marginRight: 10 }}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                className="pj-btn-primary"
                                onClick={handleUpdateAddress}
                                disabled={isUpdatingAddress || isDeletingAddress}
                            >
                                {isUpdatingAddress ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* STEP 2: Job Details Step                                                   */
/* -------------------------------------------------------------------------- */
const JobDetailsStep = ({ onBack, onSubmit, initialData, serviceInfo }) => {
    const [workDate, setWorkDate] = useState(initialData.workDate || new Date().toISOString().split('T')[0]);
    const [startHour, setStartHour] = useState(() => {
        const raw = String(initialData?.startTime || '08:00');
        const parts = raw.split(':');
        const hh = Number(parts[0]);
        if (!Number.isFinite(hh)) return 8;
        return Math.max(0, Math.min(23, hh));
    });
    const [startMinute, setStartMinute] = useState(() => {
        const raw = String(initialData?.startTime || '08:00');
        const parts = raw.split(':');
        const mm = Number(parts[1]);
        if (!Number.isFinite(mm)) return 0;
        // Chỉ cho phép chọn 00 hoặc 30.
        if (mm <= 15) return 0;
        return 30;
    });
    const [durationHours, setDurationHours] = useState(initialData.durationHours || 2);
    const [title, setTitle] = useState(initialData.title || `Cần tìm người ${serviceInfo.name.toLowerCase()}`);
    const [description, setDescription] = useState(initialData.description || '');
    const [selectedSubServiceIds, setSelectedSubServiceIds] = useState(Array.isArray(initialData.serviceIds) ? initialData.serviceIds : []);
    const [subServices, setSubServices] = useState([]);
    const [loadingSubServices, setLoadingSubServices] = useState(false);
    const [subServiceError, setSubServiceError] = useState('');

    const [preEstimate, setPreEstimate] = useState(null);
    const [loadingPrice, setLoadingPrice] = useState(false);

    const selectedSubServiceItems = useMemo(() => {
        if (!Array.isArray(subServices) || !Array.isArray(selectedSubServiceIds)) return [];
        const ids = new Set(selectedSubServiceIds.map((n) => Number(n)).filter((n) => Number.isFinite(n)));
        return subServices.filter((s) => {
            const sid = Number(s?.id ?? s?.serviceId);
            return Number.isFinite(sid) && ids.has(sid);
        });
    }, [subServices, selectedSubServiceIds]);

    useEffect(() => {
        const fetchPrice = async () => {
            setLoadingPrice(true);
            try {
                const res = await apiClient.post('/api/v1/jobs/estimate', {
                    categoryId: initialData.categoryId,
                    serviceIds: selectedSubServiceIds,
                    durationHours: durationHours
                });
                setPreEstimate(extractPayload(res));
            } catch (err) {
                console.error("Lỗi tính giá", err);
                setPreEstimate(null);
            } finally {
                setLoadingPrice(false);
            }
        };
        fetchPrice();
    }, [durationHours, initialData.categoryId, selectedSubServiceIds]);

    useEffect(() => {
        const loadSubServices = async () => {
            if (!initialData.categoryId) return;
            try {
                setLoadingSubServices(true);
                setSubServiceError('');
                const res = await apiClient.get(`/api/helpers/categories/${initialData.categoryId}/services`);
                const list = extractPayload(res);
                setSubServices(Array.isArray(list) ? list : []);
            } catch {
                setSubServices([]);
                setSubServiceError('Chưa lấy được dịch vụ con từ hệ thống.');
            } finally {
                setLoadingSubServices(false);
            }
        };
        loadSubServices();
    }, [initialData.categoryId]);

    const formatCurrency = (val) => {
        if (val === undefined || val === null) return '0 ₫';
        return val.toLocaleString('vi-VN') + ' ₫';
    };

    const handleSubmit = () => {
        const startTime = `${String(startHour).padStart(2, '0')}:${startMinute === 0 ? '00' : '30'}`;
        onSubmit({
            serviceIds: selectedSubServiceIds,
            workDate,
            startTime,
            durationHours,
            title,
            description
        }, preEstimate);
    };

    const toggleSubService = (serviceId) => {
        setSelectedSubServiceIds((prev) => {
            if (prev.includes(serviceId)) return prev.filter((id) => id !== serviceId);
            return [...prev, serviceId];
        });
    };

    const startTime = `${String(startHour).padStart(2, '0')}:${startMinute === 0 ? '00' : '30'}`;
    const isFormValid = initialData.addressId && workDate && startTime && durationHours > 0;

    return (
        <div className="pj-card">
            <div className="pj-header" style={{ borderBottomColor: serviceInfo.color }}>
                <button className="pj-back-btn" onClick={onBack}>
                    ←
                </button>
                <div className="pj-header-title">
                    <span className="pj-icon">{serviceInfo.icon}</span>
                    Đăng tin {serviceInfo.name}
                </div>
                <div className="pj-step">Bước 2/3</div>
            </div>

            <div className="pj-body">
                <div className="pj-two-columns">
                    {/* Cột trái - Form nhập thông tin */}
                    <div className="pj-column">
                        <div className="pj-section">
                            <h3 className="pj-section-title">📋 Thông tin công việc</h3>

                            <div className="pj-form-row">
                                <div className="pj-form-group half">
                                    <label className="pj-label">📅 Ngày làm việc *</label>
                                    <input
                                        type="date"
                                        className="pj-input"
                                        value={workDate}
                                        onChange={e => setWorkDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div className="pj-form-group half">
                                    <label className="pj-label">⏰ Giờ bắt đầu *</label>
                                    <div className="pj-time-dropdowns" aria-label="Chọn giờ bắt đầu (phút chỉ 00 hoặc 30)">
                                        <div className="pj-time-dropdown">
                                            <div className="pj-time-dropdown-label">Giờ</div>
                                            <select
                                                className="pj-select pj-time-select"
                                                value={startHour}
                                                onChange={(e) => setStartHour(Number(e.target.value))}
                                            >
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <option key={i} value={i}>
                                                        {String(i).padStart(2, '0')}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="pj-time-dropdown">
                                            <div className="pj-time-dropdown-label">Phút</div>
                                            <select
                                                className="pj-select pj-time-select"
                                                value={startMinute}
                                                onChange={(e) => setStartMinute(Number(e.target.value))}
                                            >
                                                <option value={0}>00</option>
                                                <option value={30}>30</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pj-form-group">
                                <label className="pj-label">⏱️ Thời lượng làm việc *</label>
                                <div className="pj-duration-group">
                                    {[1, 2, 3, 4, 6, 8].map(h => (
                                        <button
                                            key={h}
                                            className={`pj-duration-btn ${durationHours === h ? 'active' : ''}`}
                                            style={durationHours === h ? { backgroundColor: serviceInfo.color, borderColor: serviceInfo.color } : {}}
                                            onClick={() => setDurationHours(h)}
                                        >
                                            {h} giờ
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pj-form-group">
                                <label className="pj-label">🔧 Dịch vụ con (tùy chọn)</label>
                                {loadingSubServices && <div className="pj-hint">Đang tải danh sách...</div>}
                                {!loadingSubServices && subServiceError && <div className="pj-error">{subServiceError}</div>}
                                {!loadingSubServices && !subServiceError && subServices.length > 0 && (
                                    <div className="pj-services-grid">
                                        {subServices.map((item) => {
                                            const sid = Number(item?.id ?? item?.serviceId);
                                            if (!Number.isFinite(sid)) return null;
                                            const checked = selectedSubServiceIds.includes(sid);
                                            return (
                                                <button
                                                    type="button"
                                                    key={sid}
                                                    className={`pj-service-chip ${checked ? 'active' : ''}`}
                                                    onClick={() => toggleSubService(sid)}
                                                >
                                                    <span className="pj-service-name">{item?.name || 'Dịch vụ phụ'}</span>
                                                    <span className="pj-service-price">
                                                        {Number(item?.basePrice || 0).toLocaleString('vi-VN')} đ
                                                    </span>
                                                    {checked && <span className="pj-service-check">✓</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {!loadingSubServices && !subServiceError && subServices.length === 0 && (
                                    <div className="pj-hint">ℹ️ Không có dịch vụ con cho danh mục này</div>
                                )}
                            </div>

                            <div className="pj-form-group">
                                <label className="pj-label">✏️ Tiêu đề công việc</label>
                                <input
                                    type="text"
                                    className="pj-input"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Ví dụ: Dọn dẹp chung cư 2 phòng ngủ..."
                                />
                            </div>

                            <div className="pj-form-group">
                                <label className="pj-label">📝 Ghi chú thêm</label>
                                <textarea
                                    className="pj-textarea"
                                    rows="3"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Nhập yêu cầu đặc biệt, hướng dẫn cụ thể cho người làm..."
                                />
                            </div>

                            {!initialData.addressId && (
                                <div className="pj-warning">
                                    ⚠️ Bạn cần chọn địa chỉ ở bước trước
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cột phải - Tóm tắt và giá */}
                    <div className="pj-column">
                        <div className="pj-sidebar">
                            <h3 className="pj-sidebar-title">💰 Tóm tắt & giá dự kiến</h3>

                            <div className="pj-sidebar-item">
                                <span className="pj-sidebar-label">Dịch vụ con</span>
                                <span className="pj-sidebar-value">{selectedSubServiceItems.length} mục</span>
                            </div>

                            {selectedSubServiceItems.length > 0 && (
                                <div className="pj-sidebar-detail">
                                    {selectedSubServiceItems.slice(0, 3).map((s) => s?.name).filter(Boolean).join(', ')}
                                    {selectedSubServiceItems.length > 3 && ` +${selectedSubServiceItems.length - 3}`}
                                </div>
                            )}

                            <div className="pj-sidebar-item">
                                <span className="pj-sidebar-label">Thời gian</span>
                                <span className="pj-sidebar-value">{startTime} - {workDate}</span>
                            </div>

                            <div className="pj-sidebar-item">
                                <span className="pj-sidebar-label">📍 Địa chỉ</span>
                                <span className="pj-sidebar-value">{initialData.addressDetail || 'Chưa chọn địa chỉ'}</span>
                            </div>

                            <div className="pj-sidebar-item">
                                <span className="pj-sidebar-label">Số giờ</span>
                                <span className="pj-sidebar-value">{durationHours} giờ</span>
                            </div>

                            <div className="pj-divider"></div>

                            {loadingPrice ? (
                                <div className="pj-sidebar-loading">⏳ Đang tính giá...</div>
                            ) : preEstimate ? (
                                <>
                                    <div className="pj-price-label">Tổng thanh toán dự kiến</div>
                                    <div className="pj-price-value" style={{ color: serviceInfo.color }}>
                                        {formatCurrency(preEstimate.estimatedPrice)}
                                    </div>
                                    {preEstimate.basePrice && (
                                        <div className="pj-price-note">
                                            (Giá cơ bản: {formatCurrency(preEstimate.basePrice)})
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="pj-sidebar-loading">📝 Chọn dịch vụ để tính giá</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pj-actions">
                    <button
                        className={`pj-btn-primary ${!isFormValid ? 'disabled' : ''}`}
                        disabled={!isFormValid}
                        onClick={handleSubmit}
                        style={{ backgroundColor: serviceInfo.color }}
                    >
                        Tiếp tục →
                    </button>
                </div>
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* STEP 3: Confirm & Pay Step                                                 */
/* -------------------------------------------------------------------------- */
const ConfirmPayStep = ({ onBack, onConfirm, jobData, estimateData, loadingEstimate, loadingSubmit, serviceInfo }) => {

    const formatCurrency = (val) => {
        if (val === undefined || val === null) return '0 ₫';
        return val.toLocaleString('vi-VN') + ' ₫';
    };

    const selectedServiceNames = useMemo(() => {
        const fees = Array.isArray(estimateData?.serviceFees) ? estimateData.serviceFees : [];
        return fees.map((f) => f?.name).filter(Boolean);
    }, [estimateData]);

    return (
        <div className="pj-card">
            <div className="pj-header" style={{ borderBottomColor: serviceInfo.color }}>
                <button className="pj-back-btn" onClick={onBack}>
                    ←
                </button>
                <div className="pj-header-title">
                    <span className="pj-icon">✓</span>
                    Xác nhận đăng tin
                </div>
                <div className="pj-step">Bước 3/3</div>
            </div>

            <div className="pj-body">
                {loadingEstimate ? (
                    <div className="pj-loading">💰 Đang tính toán giá...</div>
                ) : (
                    <>
                        <div className="pj-summary">
                            <h3 className="pj-summary-title">📋 Thông tin công việc</h3>

                            <div className="pj-summary-row">
                                <div className="pj-summary-label">Dịch vụ</div>
                                <div className="pj-summary-value">{serviceInfo.name}</div>
                            </div>

                            <div className="pj-summary-row">
                                <div className="pj-summary-label">Dịch vụ con</div>
                                <div className="pj-summary-value">
                                    {(jobData.serviceIds?.length || 0) === 0
                                        ? 'Không chọn'
                                        : `${jobData.serviceIds.length} mục`}
                                    {selectedServiceNames.length > 0 && (
                                        <div className="pj-summary-subvalue">
                                            {selectedServiceNames.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pj-summary-row">
                                <div className="pj-summary-label">Thời gian</div>
                                <div className="pj-summary-value">{jobData.startTime} - Ngày {jobData.workDate}</div>
                            </div>

                            <div className="pj-summary-row">
                                <div className="pj-summary-label">Số giờ</div>
                                <div className="pj-summary-value">{jobData.durationHours} giờ</div>
                            </div>

                            <div className="pj-summary-row">
                                <div className="pj-summary-label">Địa chỉ</div>
                                <div className="pj-summary-value">{jobData.addressDetail}</div>
                            </div>

                            {jobData.title && (
                                <div className="pj-summary-row">
                                    <div className="pj-summary-label">Tiêu đề</div>
                                    <div className="pj-summary-value">{jobData.title}</div>
                                </div>
                            )}

                            {jobData.description && (
                                <div className="pj-summary-row">
                                    <div className="pj-summary-label">Ghi chú</div>
                                    <div className="pj-summary-value">{jobData.description}</div>
                                </div>
                            )}
                        </div>

                        {estimateData && (
                            <div className="pj-payment">
                                <div className="pj-payment-row">
                                    <span>💰 Giá dịch vụ cơ bản</span>
                                    <span>{formatCurrency(estimateData.basePrice)}</span>
                                </div>
                                {estimateData.serviceFees && estimateData.serviceFees.length > 0 && (
                                    <div className="pj-payment-detail">
                                        <div className="pj-payment-detail-title">Chi tiết dịch vụ con:</div>
                                        {estimateData.serviceFees.map((fee, idx) => (
                                            <div key={idx} className="pj-payment-detail-item">
                                                <span>{fee.name}</span>
                                                <span>{formatCurrency(fee.price)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="pj-payment-row total">
                                    <span>💎 Tổng thanh toán</span>
                                    <span style={{ color: serviceInfo.color, fontSize: '20px', fontWeight: 'bold' }}>
                                        {formatCurrency(estimateData.estimatedPrice)}
                                    </span>
                                </div>
                                <div className="pj-payment-note">
                                    🔒 Hệ thống sẽ tạm giữ số tiền này. Tiền sẽ được hoàn lại nếu không tìm được người làm.
                                </div>
                            </div>
                        )}

                        <div className="pj-actions">
                            <button
                                className={`pj-btn-primary ${loadingSubmit ? 'disabled' : ''}`}
                                disabled={loadingSubmit}
                                onClick={onConfirm}
                                style={{ backgroundColor: serviceInfo.color }}
                            >
                                {loadingSubmit ? '⏳ Đang xử lý...' : '✓ Đăng tin & Giữ tiền'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CustomerPostJobPage;