import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import ProfileService from '../../services/ProfileService';
import './CustomerPostJobPage.css';

const DEFAULT_LATITUDE = 10.762622;
const DEFAULT_LONGITUDE = 106.660172;

const THEME_PRIMARY = '#2F5D50';
const SERVICE_INFOS = {
    1: { name: 'Dọn dẹp nhà cửa', icon: '🏡', color: THEME_PRIMARY },
    2: { name: 'Nấu ăn', icon: '🍳', color: THEME_PRIMARY },
    3: { name: 'Đi chợ', icon: '🛒', color: THEME_PRIMARY },
    4: { name: 'Vệ sinh văn phòng', icon: '🏢', color: THEME_PRIMARY },
    5: { name: 'Trông trẻ', icon: '👶', color: THEME_PRIMARY },
    6: { name: 'Làm vườn', icon: '🌱', color: THEME_PRIMARY },
    7: { name: 'Sơn sửa', icon: '🔧', color: THEME_PRIMARY },
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

    // Final Submit
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
            alert(res.message || "Đăng tin thành công! Bạn có thể xem tin đã đăng ở phần Quản lý bài đăng.");
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
                const list = res?.data ?? res;
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
        <div className="post-job-container">
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
    );
};

/* -------------------------------------------------------------------------- */
/* STEP 1: Address Step                                                       */
/* -------------------------------------------------------------------------- */
const AddressStep = ({ onBack, onSelectAddress, serviceInfo }) => {
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [isLoadingSaved, setIsLoadingSaved] = useState(false);
    const [savedError, setSavedError] = useState('');

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoadingSuggest, setIsLoadingSuggest] = useState(false);
    const [suggestError, setSuggestError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [addressType, setAddressType] = useState('HOME');

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
        // Kỳ vọng format: "<detail>, <ward>, <district>, <province>" (ít nhất 4 phần)
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
            const list = res?.data ?? res;
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
            const list = res?.data ?? res;
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
            const saved = res?.data ?? res;
            // Đưa địa chỉ mới lên đầu danh sách (frontend-first)
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
        // Ưu tiên địa chỉ mặc định, sau đó ưu tiên HOME, cuối cùng giữ theo addressId giảm dần
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

    return (
        <div className="pj-card">
            <div className="pj-header" style={{ borderBottomColor: serviceInfo.color }}>
                <button className="pj-back-btn" onClick={onBack}>
                    &larr;
                </button>
                <div className="pj-header-title">
                    <span className="pj-icon">{serviceInfo.icon}</span> Chọn địa chỉ thi công
                </div>
            </div>

            <div className="pj-body">
                <div className="asc-search">
                    <label className="asc-search-label">Nhập địa chỉ thi công</label>
                    <div className="asc-search-input-wrap">
                        <input
                            type="text"
                            className="asc-search-input"
                            placeholder="Ví dụ: 60 Lý Thường Kiệt, Trần Hưng Đạo, Hoàn Kiếm, Hà Nội"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoComplete="off"
                        />
                        {isLoadingSuggest && <span className="asc-search-spinner">Đang tìm...</span>}
                    </div>

                    <div className="asc-type-row">
                        <label className="asc-type-label" htmlFor="addressTypeSelect">Loại địa chỉ</label>
                        <select
                            id="addressTypeSelect"
                            className="asc-type-select"
                            value={addressType}
                            onChange={(e) => setAddressType(e.target.value)}
                            disabled={isSaving}
                        >
                            <option value="HOME">Nhà</option>
                            <option value="OFFICE">Văn phòng</option>
                            <option value="OTHER">Khác</option>
                        </select>
                    </div>

                    {suggestError && <div className="asc-error">{suggestError}</div>}

                    {suggestions.length > 0 && (
                        <div className="asc-suggest-box">
                            {suggestions.map((sug) => (
                                <button
                                    type="button"
                                    key={sug.place_id || sug.placeId || sug.description}
                                    className="asc-suggest-item"
                                    onClick={() => handlePickSuggestion(sug)}
                                    disabled={isSaving}
                                >
                                    <span className="asc-suggest-title">{sug.description}</span>
                                    <span className="asc-suggest-sub">{isSaving ? 'Đang lưu...' : 'Chọn'}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {isLoadingSuggest && normalizedQuery.length >= 3 && suggestions.length === 0 && !suggestError && (
                        <div className="asc-hint">Đang tải gợi ý...</div>
                    )}
                    {!isLoadingSuggest && normalizedQuery.length >= 3 && suggestions.length === 0 && !suggestError && (
                        <div className="asc-hint">Không có gợi ý phù hợp. Hãy nhập chi tiết hơn (đủ phường, quận, tỉnh).</div>
                    )}
                </div>

                <h2 className="asc-saved-title">Danh sách địa chỉ đã lưu</h2>
                <div className="asc-saved-list">
                    {isLoadingSaved && <div className="asc-hint">Đang tải địa chỉ đã lưu...</div>}
                    {!isLoadingSaved && savedError && <div className="asc-error">{savedError}</div>}

                    {!isLoadingSaved && !savedError && savedAddresses.length === 0 && (
                        <div className="asc-hint">Bạn chưa lưu địa chỉ nào. Hãy nhập ở ô phía trên và chọn từ gợi ý.</div>
                    )}

                    {!isLoadingSaved && !savedError && sortedSavedAddresses.map(addr => (
                        <div className="asc-address-item" key={addr.addressId} onClick={() => handlePickSaved(addr)}>
                            <div className="asc-address-icon-wrap" style={{ backgroundColor: `${serviceInfo.color}15`, color: serviceInfo.color }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div className="asc-address-info">
                                <p className="asc-address-name">
                                    {String(addr.type || '').toUpperCase() === 'HOME'
                                        ? 'Nhà'
                                        : String(addr.type || '').toUpperCase() === 'OFFICE'
                                            ? 'Văn phòng'
                                            : 'Khác'}
                                </p>
                                <p className="asc-address-detail">{buildFullAddress(addr)}</p>
                            </div>
                            <svg className="asc-address-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/* STEP 2: Job Details Step                                                   */
/* -------------------------------------------------------------------------- */
const JobDetailsStep = ({ onBack, onSubmit, initialData, serviceInfo }) => {
    const [workDate, setWorkDate] = useState(initialData.workDate || new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState(initialData.startTime || '08:00');
    const [durationHours, setDurationHours] = useState(initialData.durationHours || 2);
    const [title, setTitle] = useState(initialData.title || `Cần tìm người ${serviceInfo.name.toLowerCase()}`);
    const [description, setDescription] = useState(initialData.description || '');
    const [selectedSubServiceIds, setSelectedSubServiceIds] = useState(Array.isArray(initialData.serviceIds) ? initialData.serviceIds : []);
    const [subServices, setSubServices] = useState([]);
    const [loadingSubServices, setLoadingSubServices] = useState(false);
    const [subServiceError, setSubServiceError] = useState('');

    const [preEstimate, setPreEstimate] = useState(null);
    const [loadingPrice, setLoadingPrice] = useState(false);

    useEffect(() => {
        const fetchPrice = async () => {
            setLoadingPrice(true);
            try {
                const res = await apiClient.post('/api/v1/jobs/estimate', {
                    categoryId: initialData.categoryId,
                    serviceIds: selectedSubServiceIds,
                    durationHours: durationHours
                });
                setPreEstimate(res?.data ?? res);
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
                const res = await apiClient.get(`/api/v1/admin/categories/${initialData.categoryId}/services`);
                const list = res?.data ?? res;
                setSubServices(Array.isArray(list) ? list : []);
            } catch {
                setSubServices([]);
                setSubServiceError('Chưa lấy được dịch vụ con từ hệ thống. Bạn vẫn có thể tiếp tục đăng tin với dịch vụ chính.');
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

    const isFormValid = initialData.addressId && workDate && startTime && durationHours > 0;

    return (
        <div className="pj-card slide-left">
            <div className="pj-header" style={{ borderBottomColor: serviceInfo.color }}>
                <button className="pj-back-btn" onClick={onBack}>&larr;</button>
                <div className="pj-header-title">
                    <span className="pj-icon">{serviceInfo.icon}</span> Bổ sung thông tin
                </div>
            </div>
            <div className="pj-body">
                <div className="pj-service-banner" style={{ backgroundColor: `${serviceInfo.color}15`, color: serviceInfo.color }}>
                    Dịch vụ: <strong>{serviceInfo.name}</strong>
                </div>

                <div className="pjf-row">
                    <div className="pjf-group pjf-half">
                        <label className="pjf-label">Ngày làm việc (*)</label>
                        <input type="date" className="pjf-control" value={workDate} onChange={e => setWorkDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="pjf-group pjf-half">
                        <label className="pjf-label">Giờ bắt đầu (*)</label>
                        <input type="time" className="pjf-control" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    </div>
                </div>

                <div className="pjf-group">
                    <label className="pjf-label">Dịch vụ con (tuỳ chọn)</label>
                    {loadingSubServices && <div className="pjs-hint">Đang tải danh sách dịch vụ con...</div>}
                    {!loadingSubServices && subServiceError && <div className="pjs-error">{subServiceError}</div>}
                    {!loadingSubServices && !subServiceError && subServices.length > 0 && (
                        <div className="pjs-grid">
                            {subServices.map((item) => {
                                const sid = Number(item?.serviceId);
                                const checked = selectedSubServiceIds.includes(sid);
                                return (
                                    <button
                                        type="button"
                                        key={sid}
                                        className={`pjs-chip ${checked ? 'is-active' : ''}`}
                                        onClick={() => toggleSubService(sid)}
                                    >
                                        <span className="pjs-chip-name">{item?.name || 'Dịch vụ phụ'}</span>
                                        <span className="pjs-chip-price">
                                            {Number(item?.basePrice || 0).toLocaleString('vi-VN')} đ
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="pjf-group">
                    <label className="pjf-label">Thời lượng (giờ) (*)</label>
                    <div className="duration-selector">
                        {[1, 2, 3, 4, 6, 8].map(h => (
                            <button 
                                key={h} 
                                className={`duration-btn ${durationHours === h ? 'active' : ''}`}
                                style={durationHours === h ? { backgroundColor: serviceInfo.color, borderColor: serviceInfo.color } : {}}
                                onClick={() => setDurationHours(h)}
                            >
                                {h} giờ
                            </button>
                        ))}
                    </div>
                    {loadingPrice ? (
                        <div style={{ marginTop: '12px', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>Đang tính giá...</div>
                    ) : preEstimate ? (
                        <div style={{ marginTop: '12px', fontSize: '15.5px', fontWeight: '600', color: serviceInfo.color }}>
                            Dự kiến: {formatCurrency(preEstimate.estimatedPrice)}
                        </div>
                    ) : null}
                </div>

                <div className="pjf-group">
                    <label className="pjf-label">Tiêu đề công việc</label>
                    <input type="text" className="pjf-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Dọn dẹp chung cư 2 phòng ngủ..." />
                </div>

                <div className="pjf-group">
                    <label className="pjf-label">Ghi chú thêm (Không bắt buộc)</label>
                    <textarea className="pjf-control" rows="3" value={description} onChange={e => setDescription(e.target.value)} placeholder="Nhập yêu cầu đặc biệt của bạn cho người làm..."></textarea>
                </div>

                <button 
                    className={`pj-btn-primary ${!isFormValid ? 'disabled' : ''}`} 
                    disabled={!isFormValid} 
                    onClick={handleSubmit}
                    style={{ backgroundColor: serviceInfo.color }}
                >
                    Tiếp tục
                </button>
                {!initialData.addressId && (
                    <div className="pjs-hint">Bạn cần chọn địa chỉ ở bước trước trước khi tiếp tục.</div>
                )}
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

    return (
        <div className="pj-card slide-left">
            <div className="pj-header" style={{ borderBottomColor: serviceInfo.color }}>
                <button className="pj-back-btn" onClick={onBack}>&larr;</button>
                <div className="pj-header-title">
                    Xác nhận & Thanh toán
                </div>
            </div>
            
            <div className="pj-body">
                {loadingEstimate ? (
                    <div className="pj-loading">Đang tính toán giá...</div>
                ) : (
                    <>
                        <div className="pj-summary-box">
                            <h3 className="pj-summary-title">Thông tin giao việc</h3>
                            <ul className="pj-summary-list">
                                <li><span>Dịch vụ:</span> <strong>{serviceInfo.name}</strong></li>
                                <li><span>Dịch vụ con:</span> <strong>{Array.isArray(jobData.serviceIds) ? jobData.serviceIds.length : 0} mục</strong></li>
                                <li><span>Thời gian:</span> <strong>{jobData.startTime} - Ngày {jobData.workDate}</strong></li>
                                <li><span>Số giờ:</span> <strong>{jobData.durationHours} giờ</strong></li>
                                <li><span>Địa chỉ:</span> <span>{jobData.addressDetail}</span></li>
                            </ul>
                        </div>

                        {estimateData && (
                            <div className="pj-price-box">
                                <div className="price-row">
                                    <span>Giá dịch vụ cơ bản</span>
                                    <span>{formatCurrency(estimateData.basePrice)}</span>
                                </div>
                                <div className="price-row total">
                                    <span>Tổng thanh toán</span>
                                    <span style={{ color: serviceInfo.color }}>{formatCurrency(estimateData.estimatedPrice)}</span>
                                </div>
                                <p className="price-note">
                                    Hệ thống sẽ tạm giữ số tiền này trong ví của bạn. Số tiền sẽ được hoàn lại nếu không tìm được người làm.
                                </p>
                            </div>
                        )}

                        <button 
                            className={`pj-btn-primary ${loadingSubmit ? 'disabled' : ''}`} 
                            disabled={loadingSubmit} 
                            onClick={onConfirm}
                            style={{ backgroundColor: serviceInfo.color }}
                        >
                            {loadingSubmit ? 'Đang xử lý...' : 'Đăng tin & Giữ tiền'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default CustomerPostJobPage;
