import React, { useState, useEffect, useCallback } from 'react';
import './DirectBookingModal.css';
import BookingService from '../services/BookingService';
import ProfileService from '../services/ProfileService';
import NotificationModal from './NotificationModal';
import apiClient from '../services/apiClient';

/* ─── Category IDs (khớp backend) ─────────────────── */
const CAT_HOME_CLEAN = 1;
const CAT_COOKING = 2;
const CAT_SHOPPING = 3;
const CAT_OFFICE_CLEAN = 4;
const CAT_CHILDCARE = 5;
const CAT_GARDEN = 6;
const CAT_PAINT = 7;

/* ─── Category-specific Configurations ────────────── */
const HOME_CLEANING_DURATION_AREA = {
    2: { minM2: 30, maxM2: 50, hint: 'Studio, căn 1 phòng' },
    3: { minM2: 50, maxM2: 70, hint: 'Căn 2 phòng nhỏ' },
    4: { minM2: 70, maxM2: 100, hint: '2–3 phòng' },
};

const OFFICE_DURATION_AREA = {
    4: { minM2: 100, maxM2: 150, hint: 'Văn phòng vừa' },
    6: { minM2: 150, maxM2: 200, hint: 'Văn phòng lớn' },
    8: { minM2: 200, maxM2: 300, hint: 'Văn phòng rất rộng >200m²' },
};

const GARDEN_DURATION_AREA = {
    4: { minM2: 100, maxM2: 150, hint: 'Sân vườn vừa' },
    6: { minM2: 150, maxM2: 200, hint: 'Sân vườn lớn' },
    8: { minM2: 200, maxM2: 300, hint: 'Sân vườn rất rộng >200m²' },
};

const formatVnd = (n) => {
    if (!n && n !== 0) return '—';
    return Number(n).toLocaleString('vi-VN') + ' ₫';
};

const THEME_PRIMARY = '#2F5D50';

const DirectBookingModal = ({ helper, onClose, onSuccess }) => {
    if (!helper) return null;

    const helperCats = helper.categories || [];

    /* ─── State ──────────────────────────────────────── */
    const [categoryId, setCategoryId] = useState(helperCats[0]?.id || helperCats[0]?.categoryId || '');
    const [subServices, setSubServices] = useState([]);
    const [selectedSubs, setSelectedSubs] = useState([]);

    const [workDate, setWorkDate] = useState('');
    const [startHour, setStartHour] = useState(8);
    const [startMinute, setStartMinute] = useState(0);
    const [durationHours, setDurationHours] = useState(2);
    const [description, setDescription] = useState('');

    // Address & Location
    const [addressDetail, setAddressDetail] = useState('');
    const [addressId, setAddressId] = useState(null);
    const [lat, setLat] = useState(null);
    const [lng, setLng] = useState(null);
    const [provinceId, setProvinceId] = useState('');
    const [districtId, setDistrictId] = useState('');
    const [wardId, setWardId] = useState('');
    const [provinceName, setProvinceName] = useState('');
    const [districtName, setDistrictName] = useState('');
    const [wardName, setWardName] = useState('');
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingSaved, setLoadingSaved] = useState(false);

    // Attributes
    const [workSize, setWorkSize] = useState('');
    const [numPeople, setNumPeople] = useState(1);

    // Validation
    const [isDistrictSupported, setIsDistrictSupported] = useState(true);
    const [unsupportedDistrict, setUnsupportedDistrict] = useState('');
    const [numChildren, setNumChildren] = useState(1);
    const [paintItems, setPaintItems] = useState(1);
    const [shopAmount, setShopAmount] = useState('');
    const [taskerAdvance, setTaskerAdvance] = useState(false);
    const [taskerShop, setTaskerShop] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const [bringTools, setBringTools] = useState(false);
    const [hasPets, setHasPets] = useState(false);

    const [estimatedPrice, setEstimatedPrice] = useState(null);
    const [estimating, setEstimating] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const catId = parseInt(categoryId, 10);

    /* ─── Load sub-services ─────────────────────────── */
    useEffect(() => {
        if (!catId) return;
        apiClient.get(`/api/helpers/categories/${catId}/services`)
            .then(res => {
                // API helpers trả về List trực tiếp, ApiResponse trả về wrap data
                const list = Array.isArray(res) ? res : (res?.data?.data || res?.data || []);
                setSubServices(list);
            })
            .catch(() => setSubServices([]));
        setSelectedSubs([]);
        setEstimatedPrice(null);

        // Auto-assign workSize for CAT_HOME_CLEAN if we switch to it
        if (catId === CAT_HOME_CLEAN) {
            setWorkSize(50);
        } else {
            setWorkSize('');
        }

        // Reset options based on category applicability
        const canPet = catId === CAT_HOME_CLEAN;
        const canTool = [CAT_HOME_CLEAN, CAT_OFFICE_CLEAN, CAT_GARDEN, CAT_PAINT].includes(catId);

        if (!canPet) setHasPets(false);
        if (!canTool) setBringTools(false);
    }, [catId]);

    // Đồng bộ diện tích tự động với thời lượng (nếu là dịch vụ cần chọn theo gói)
    useEffect(() => {
        const h = parseInt(durationHours) || 2;
        if (catId === CAT_HOME_CLEAN) {
            const meta = HOME_CLEANING_DURATION_AREA[h] || HOME_CLEANING_DURATION_AREA[2];
            setWorkSize((meta.minM2 + meta.maxM2) / 2);
        } else if (catId === CAT_OFFICE_CLEAN) {
            const meta = OFFICE_DURATION_AREA[h] || OFFICE_DURATION_AREA[4] || { minM2: 100, maxM2: 150 };
            setWorkSize((meta.minM2 + meta.maxM2) / 2);
        } else if (catId === CAT_GARDEN) {
            const meta = GARDEN_DURATION_AREA[h] || GARDEN_DURATION_AREA[4] || { minM2: 100, maxM2: 150 };
            setWorkSize((meta.minM2 + meta.maxM2) / 2);
        }
    }, [durationHours, catId]);

    /* ─── Load saved addresses ──────────────────────── */
    useEffect(() => {
        setLoadingSaved(true);
        apiClient.get('/api/v1/addresses')
            .then(res => {
                const list = res?.data?.data || res?.data || [];
                const finalAddresses = Array.isArray(list) ? list : [];
                setSavedAddresses(finalAddresses);

                // Favor default address for initial selection
                const def = finalAddresses.find(a => a.isDefault);
                if (def) {
                    handleSelectSaved(def);
                } else if (finalAddresses.length > 0) {
                    handleSelectSaved(finalAddresses[0]);
                } else {
                    // Fallback to profile primary address
                    apiClient.get('/api/v1/profile').then(profileRes => {
                        const profile = profileRes?.data?.data || profileRes?.data || profileRes;
                        if (profile?.fullAddress) {
                            setAddressDetail(profile.fullAddress);
                            setLat(profile.latitude);
                            setLng(profile.longitude);
                        }
                    }).catch(pErr => console.error("Profile fallback error:", pErr));
                }
            })
            .catch(err => {
                console.error("Failed to load addresses:", err);
                setSavedAddresses([]);
            })
            .finally(() => setLoadingSaved(false));
    }, []);

    /* ─── Goong Autocomplete ───────────────────────── */
    useEffect(() => {
        if (!addressDetail || addressDetail.length < 3 || !showSuggestions) {
            setSuggestions([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await apiClient.get(`/api/v1/addresses/autocomplete?input=${encodeURIComponent(addressDetail)}`);
                setSuggestions(res?.data?.data || res?.data || []);
            } catch (err) {
                console.error("Goong autocomplete error:", err);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [addressDetail, showSuggestions]);

    const handleSelectSuggestion = async (sug) => {
        setAddressDetail(sug.description);
        setAddressId(null);
        setShowSuggestions(false);

        const district = extractDistrict(sug.description);
        const valid = isDistrictValid(district);
        setIsDistrictSupported(valid);
        setUnsupportedDistrict(valid ? '' : district);

        try {
            const res = await apiClient.get(`/api/v1/addresses/detail-v2?placeId=${sug.place_id}`);
            const data = res?.data?.data || res?.data || {};
            setLat(data.latitude);
            setLng(data.longitude);
            setProvinceId(data.provinceId || '');
            setDistrictId(data.districtId || '');
            setWardId(data.wardId || '');
            setProvinceName(data.provinceName || '');
            setDistrictName(data.districtName || '');
            setWardName(data.wardName || '');

            // Re-validate district support with specific district name from components
            const valid = isDistrictValid(data.districtName);
            setIsDistrictSupported(valid);
            setUnsupportedDistrict(valid ? '' : data.districtName);
        } catch (err) {
            console.error("Goong detail error:", err);
        }
    };

    const getAddressLabel = (type) => {
        const t = String(type || '').toUpperCase();
        if (t === 'HOME') return { text: 'Nhà riêng', icon: '🏠' };
        if (t === 'OFFICE') return { text: 'Văn phòng', icon: '🏢' };
        return { text: 'Khác', icon: '📍' };
    };

    const isDistrictValid = (districtName) => {
        if (!helper.workingDistricts || helper.workingDistricts.length === 0) return true;
        if (!districtName) return true;

        const cleanDist = districtName.toLowerCase().replace(/^(quận|huyện|thành phố)\s+/i, '').trim();
        return helper.workingDistricts.some(d => {
            const supportDist = (d.name || d).toLowerCase().replace(/^(quận|huyện|thành phố)\s+/i, '').trim();
            return cleanDist === supportDist || supportDist.includes(cleanDist) || cleanDist.includes(supportDist);
        });
    };

    const extractDistrict = (fullAddress) => {
        if (!fullAddress) return null;
        // Vietnamese address often follow format: ..., District, Province
        const parts = fullAddress.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            // Usually the second to last part is the district
            return parts[parts.length - 2];
        }
        return null;
    };

    const handleSelectSaved = (addr) => {
        const full = [addr.addressDetail, addr.wardName, addr.districtName, addr.provinceName]
            .filter(Boolean).join(', ');
        setAddressDetail(full);
        setAddressId(addr.addressId);
        setLat(addr.latitude);
        setLng(addr.longitude);
        setProvinceId(addr.provinceId || '');
        setDistrictId(addr.districtId || '');
        setWardId(addr.wardId || '');
        setProvinceName(addr.provinceName || '');
        setDistrictName(addr.districtName || '');
        setWardName(addr.wardName || '');
        setShowSuggestions(false);

        const valid = isDistrictValid(addr.districtName);
        setIsDistrictSupported(valid);
        setUnsupportedDistrict(valid ? '' : addr.districtName);
    };

    /* ─── Estimate price live ───────────────────────── */
    const buildAdditionalData = () => {
        const d = {};
        if (catId === CAT_COOKING && taskerShop) d.isTaskerShopping = true;
        if (catId === CAT_SHOPPING) {
            if (taskerAdvance) d.isTaskerAdvance = true;
            if (shopAmount) d.shoppingAmount = parseFloat(shopAmount) || 0;
        }
        return Object.keys(d).length > 0 ? d : undefined;
    };

    const getWorkSize = () => {
        if (catId === CAT_HOME_CLEAN || catId === CAT_OFFICE_CLEAN || catId === CAT_GARDEN)
            return workSize ? parseFloat(workSize) : undefined;
        if (catId === CAT_COOKING) return numPeople;
        if (catId === CAT_CHILDCARE) return numChildren;
        if (catId === CAT_PAINT) return paintItems;
        return undefined;
    };

    const estimate = useCallback(async () => {
        if (!categoryId || !durationHours) return;
        setEstimating(true);
        try {
            const payload = {
                categoryId: catId,
                durationHours: parseInt(durationHours, 10),
                serviceIds: selectedSubs,
                workSize: getWorkSize(),
                isPremium,
                bringTools,
                hasPets,
                additionalData: buildAdditionalData()
            };
            const res = await apiClient.post('/api/v1/jobs/estimate', payload);
            setEstimatedPrice(res?.data?.data?.estimatedPrice ?? res?.data?.estimatedPrice ?? null);
        } catch {
            setEstimatedPrice(null);
        } finally {
            setEstimating(false);
        }
    }, [catId, durationHours, selectedSubs, workSize, numPeople, numChildren, paintItems, shopAmount, taskerAdvance, taskerShop, isPremium, bringTools, hasPets]);

    useEffect(() => { estimate(); }, [estimate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!workDate || !categoryId) {
            setToast({ type: 'error', message: 'Vui lòng điền đầy đủ thông tin!' });
            return;
        }
        setLoading(true);
        try {
            const payload = {
                helperId: helper.id,
                categoryId: catId,
                serviceIds: selectedSubs,
                workDate,
                startTime: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
                durationHours: parseInt(durationHours, 10),
                description,
                addressId,
                addressDetail,
                provinceId,
                districtId,
                wardId,
                provinceName,
                districtName,
                wardName,
                latitude: lat,
                longitude: lng,
                workSize: getWorkSize(),
                isPremium,
                bringTools,
                hasPets,
                additionalData: buildAdditionalData()
            };
            await BookingService.createDirectBooking(payload);
            setToast({ type: 'success', message: 'Yêu cầu đặt thợ đã gửi!' });
            setTimeout(() => { if (onSuccess) onSuccess(); onClose(); }, 2000);
        } catch (err) {
            console.error("Direct booking error:", err);
            setToast({ type: 'error', message: err.message || 'Đặt thợ thất bại.' });
        } finally {
            setLoading(false);
        }
    };

    const toggleSub = (id) => {
        if (catId === CAT_HOME_CLEAN) {
            setSelectedSubs(prev => {
                if (prev.includes(id)) return prev.filter(s => s !== id);
                if (parseInt(durationHours) + prev.length + 1 > 4) {
                    setToast({ type: 'warning', message: 'Hệ thống chỉ hỗ trợ đặt tối đa 4 giờ làm việc. Vui lòng giảm thời lượng chính hoặc bỏ bớt dịch vụ con.' });
                    return prev;
                }
                return [...prev, id];
            });
        } else {
            setSelectedSubs(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
        }
    };

    const applyCleaningPreset = (h, area) => {
        setDurationHours(h);
        setWorkSize(area);
    };

    /* ─── Render ────────────────────────────────────── */
    return (
        <div className="direct-booking-overlay" onClick={onClose}>
            {toast && <NotificationModal message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="direct-booking-refined" onClick={e => e.stopPropagation()}>
                {/* Header Section */}
                <div className="db-header">
                    <div className="db-header-main">
                        <h2 className="db-title">Đặt thợ trực tiếp</h2>
                        <button className="db-close-x" onClick={onClose}>×</button>
                    </div>
                    <div className="db-helper-card">
                        <img src={helper.avatarUrl || '/default-avatar.png'} alt={helper.fullName} className="db-helper-img" />
                        <div className="db-helper-meta">
                            <span className="db-helper-name">{helper.fullName}</span>
                            <span className="db-helper-sub">{helper.ratingAverage || '5.0'} ⭐ · {helper.experienceYears || 0} yr exp</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="db-form">
                    {/* Step 1: Service Selection */}
                    <div className="db-section">
                        <label className="db-label">🛠 Dịch vụ chính</label>
                        <div className="db-cat-list">
                            {helperCats.map(cat => (
                                <button key={cat.id || cat.categoryId} type="button"
                                    className={`db-cat-btn ${catId === (cat.id || cat.categoryId) ? 'active' : ''}`}
                                    onClick={() => setCategoryId(cat.id || cat.categoryId)}>
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {subServices.length > 0 ? (
                            <div className="db-sub-section">
                                <label className="db-label-sub">Dịch vụ con (tùy chọn)</label>
                                <div className="db-sub-info-box">
                                    Mỗi dịch vụ con cộng <strong>+1 giờ</strong> vào tổng thời lượng làm việc; phí dịch vụ được tính riêng và không làm tăng tiền giờ phần chính.
                                </div>
                                <div className="db-sub-list">
                                    {subServices.map(s => {
                                        const active = selectedSubs.includes(s.id);
                                        return (
                                            <div key={s.id} className={`db-sub-item ${active ? 'active' : ''}`}
                                                onClick={() => toggleSub(s.id)}>
                                                <div className="db-sub-item-check">{active ? '✓' : '+'}</div>
                                                <div className="db-sub-item-info">
                                                    <span className="db-sub-item-name">{s.name}</span>
                                                    <div className="db-sub-item-meta">
                                                        <span className="db-sub-item-h">+1h tổng</span>
                                                        <span className="db-sub-item-price">{formatVnd(s.basePrice)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="db-sub-section db-no-sub-box">
                                <span className="db-no-sub-text">Dịch vụ này không có dịch vụ con kèm theo.</span>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Scheduling */}
                    <div className="db-grid-main">
                        <div className="db-input-group">
                            <label>📅 Ngày làm việc</label>
                            <input type="date" className="db-field" value={workDate}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setWorkDate(e.target.value)} required />
                        </div>
                        <div className="db-input-group">
                            <label>⏰ Giờ bắt đầu</label>
                            <div className="db-time-flex">
                                <select className="db-select" value={startHour} onChange={e => setStartHour(parseInt(e.target.value))}>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                                    ))}
                                </select>
                                <select className="db-select" value={startMinute} onChange={e => setStartMinute(parseInt(e.target.value))}>
                                    <option value={0}>00</option>
                                    <option value={30}>30</option>
                                </select>
                            </div>
                        </div>

                        <div className="db-input-group full-row">
                            <label>⏱️ Thời lượng & Chi tiết</label>

                            {/* Cleaning Area Presets */}
                            {catId === CAT_HOME_CLEAN && (
                                <div className="db-area-presets">
                                    {[2, 3, 4].map(h => {
                                        const meta = HOME_CLEANING_DURATION_AREA[h];
                                        const active = parseInt(durationHours) === h;
                                        const disabled = h + selectedSubs.length > 4;
                                        return (
                                            <button key={h} type="button"
                                                className={`db-preset-card ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                                                onClick={() => {
                                                    if (disabled) {
                                                        setToast({ type: 'warning', message: 'Hệ thống chỉ hỗ trợ đặt tối đa 4 giờ làm việc. Vui lòng bỏ bớt dịch vụ con để chọn khung giờ lớn hơn.' });
                                                    } else {
                                                        applyCleaningPreset(h, (meta.minM2 + meta.maxM2) / 2);
                                                    }
                                                }}>
                                                <span className="db-preset-h">{h} giờ</span>
                                                <span className="db-preset-m">{meta.minM2}-{meta.maxM2} m²</span>
                                                <span className="db-preset-hint">{meta.hint}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Cooking - Number of People */}
                            {catId === CAT_COOKING && (
                                <div className="db-special-row">
                                    <div className="db-mini-field">
                                        <label>👥 Số người ăn</label>
                                        <input type="number" className="db-field" min="1" max="8"
                                            value={numPeople}
                                            onChange={e => {
                                                const val = Math.max(1, Math.min(8, parseInt(e.target.value) || 1));
                                                setNumPeople(val);
                                            }}
                                        />
                                    </div>
                                    <div className="db-dur-select">
                                        <label>⏱️ Thời gian nấu</label>
                                        <select className="db-select" value={durationHours} onChange={e => setDurationHours(e.target.value)}>
                                            {[2, 3, 4, 6].map(h => <option key={h} value={h}>{h} giờ</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Childcare - Number of Children */}
                            {catId === CAT_CHILDCARE && (
                                <div className="db-special-row">
                                    <div className="db-mini-field">
                                        <label>👶 Số trẻ</label>
                                        <select className="db-select" value={numChildren} onChange={e => setNumChildren(e.target.value)}>
                                            <option value={1}>1 trẻ</option>
                                            <option value={2}>2 trẻ</option>
                                        </select>
                                    </div>
                                    <div className="db-dur-select">
                                        <label>⏱️ Thời gian trông</label>
                                        <select className="db-select" value={durationHours} onChange={e => setDurationHours(e.target.value)}>
                                            {[2, 3, 4, 6, 8, 10].map(h => <option key={h} value={h}>{h} giờ</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Gardening & Office - Presets only */}
                            {(catId === CAT_GARDEN || catId === CAT_OFFICE_CLEAN) && (
                                <>
                                    <div className="db-area-presets">
                                        {[4, 6, 8].map(h => {
                                            const meta = catId === CAT_OFFICE_CLEAN ? OFFICE_DURATION_AREA[h] : GARDEN_DURATION_AREA[h];
                                            const active = parseInt(durationHours) === h;
                                            return (
                                                <button key={h} type="button"
                                                    className={`db-preset-card ${active ? 'active' : ''}`}
                                                    onClick={() => applyCleaningPreset(h, (meta.minM2 + meta.maxM2) / 2)}>
                                                    <span className="db-preset-h">{h} giờ</span>
                                                    <span className="db-preset-m">{meta.minM2}-{meta.maxM2} m²</span>
                                                    <span className="db-preset-hint">{meta.hint}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="db-sub-info-box" style={{ marginTop: '0.5rem' }}>
                                        📍 Vui lòng chọn gói diện tích phù hợp để thợ có sự chuẩn bị tốt nhất.
                                    </div>
                                </>
                            )}

                            {/* Paint & Repair - Items */}
                            {catId === CAT_PAINT && (
                                <div className="db-special-row">
                                    <div className="db-mini-field">
                                        <label>🔨 Số hạng mục</label>
                                        <input type="number" className="db-field" min="1" max="8"
                                            value={paintItems}
                                            onChange={e => {
                                                const val = Math.max(1, Math.min(8, parseInt(e.target.value) || 1));
                                                setPaintItems(val);
                                            }}
                                        />
                                    </div>
                                    <div className="db-dur-select">
                                        <label>⏱️ Thời lượng</label>
                                        <select className="db-select" value={durationHours} onChange={e => setDurationHours(e.target.value)}>
                                            {[2, 3, 4, 6, 8].map(h => <option key={h} value={h}>{h} giờ</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Shopping - Amount & Hours */}
                            {catId === CAT_SHOPPING && (
                                <div className="db-special-row">
                                    <div className="db-mini-field">
                                        <label>🛒 Tiền hàng ước tính</label>
                                        <input type="number" className="db-field" step="1000" min="0" max="1000000"
                                            value={shopAmount}
                                            onChange={e => {
                                                const val = Math.max(0, Math.min(1000000, parseFloat(e.target.value) || 0));
                                                setShopAmount(val);
                                            }}
                                            placeholder="VNĐ" />
                                    </div>
                                    <div className="db-dur-select">
                                        <label>⏱️ Thời lượng</label>
                                        <input type="text" className="db-field" value="2 giờ (cố định)" disabled />
                                    </div>
                                </div>
                            )}

                            {/* Basic Duration Chips (if no special row above) */}
                            {![CAT_HOME_CLEAN, CAT_COOKING, CAT_CHILDCARE, CAT_GARDEN, CAT_OFFICE_CLEAN, CAT_PAINT, CAT_SHOPPING].includes(catId) && (
                                <div className="db-duration-chips">
                                    {[2, 3, 4, 8].map(h => (
                                        <button key={h} type="button"
                                            className={`db-dur-chip ${parseInt(durationHours) === h ? 'active' : ''}`}
                                            onClick={() => setDurationHours(h)}>{h} giờ</button>
                                    ))}
                                    <input type="number" className="db-field db-dur-custom" value={durationHours}
                                        min={1} max={12} onChange={e => setDurationHours(e.target.value)} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 3: Address & Options */}
                    <div className="db-section">
                        <label className="db-label">📍 Địa chỉ làm việc</label>
                        <div className="db-address-box">
                            <div className="db-address-list">
                                {loadingSaved && <div className="db-loading-small">Đang tải địa chỉ...</div>}
                                {!loadingSaved && savedAddresses.length === 0 && (
                                    <div className="db-no-addr">Chưa có địa chỉ đã lưu</div>
                                )}
                                {savedAddresses.map(addr => {
                                    const active = (lat === addr.latitude && lng === addr.longitude);
                                    const { text, icon } = getAddressLabel(addr.type || addr.label);
                                    return (
                                        <div key={addr.addressId}
                                            className={`db-addr-item ${active ? 'active' : ''}`}
                                            onClick={() => handleSelectSaved(addr)}>
                                            <div className="db-addr-item-icon">{icon}</div>
                                            <div className="db-addr-item-info">
                                                <div className="db-addr-item-type">{text}</div>
                                                <div className="db-addr-item-detail">{addr.addressDetail}</div>
                                            </div>
                                            {active && <div className="db-addr-check">✓</div>}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="db-addr-input-wrap">
                                <input type="text" className="db-field" value={addressDetail}
                                    placeholder="Nhập địa chỉ chi tiết..."
                                    onFocus={() => setShowSuggestions(true)}
                                    onChange={e => { setAddressDetail(e.target.value); setShowSuggestions(true); }} required />
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="db-sug-list">
                                        {suggestions.map((sug, idx) => (
                                            <div key={idx} className="db-sug-item" onClick={() => handleSelectSuggestion(sug)}>
                                                <div className="db-sug-main">{sug.structured_formatting?.main_text || sug.description}</div>
                                                <div className="db-sug-sub">{sug.description}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {!isDistrictSupported && (
                            <div className="db-addr-error">
                                ⚠️ Rất tiếc, thợ không nhận việc tại {unsupportedDistrict || 'khu vực này'}.
                            </div>
                        )}
                    </div>

                    <div className="db-options-section">
                        <div className="db-toggle-row">
                            <label className={`db-toggle-pill ${isPremium ? 'active' : ''}`}>
                                <input type="checkbox" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} />
                                <span className="db-toggle-icon">⭐</span>
                                <span className="db-toggle-text">Dịch vụ ưu tiên (+50k)</span>
                            </label>
                        </div>

                        <div className="db-toggle-row">
                            {[CAT_HOME_CLEAN, CAT_OFFICE_CLEAN, CAT_GARDEN, CAT_PAINT].includes(catId) && (
                                <label className={`db-toggle-pill ${bringTools ? 'active' : ''}`}>
                                    <input type="checkbox" checked={bringTools} onChange={e => setBringTools(e.target.checked)} />
                                    <span className="db-toggle-icon">🧹</span>
                                    <span className="db-toggle-text">Mang dụng cụ (+30.000 đ)</span>
                                </label>
                            )}
                            {catId === CAT_HOME_CLEAN && (
                                <label className={`db-toggle-pill ${hasPets ? 'active' : ''}`}>
                                    <input type="checkbox" checked={hasPets} onChange={e => setHasPets(e.target.checked)} />
                                    <span className="db-toggle-icon">🐾</span>
                                    <span className="db-toggle-text">Nhà có thú cưng (+30.000 đ)</span>
                                </label>
                            )}
                        </div>

                        <div className="db-notes-wrap">
                            <label className="db-notes-label">📝 Ghi chú thêm cho thợ</label>
                            <textarea
                                className="db-field db-notes-area"
                                placeholder="Ví dụ: Mang theo nước tẩy rửa, Nhà có người già..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Footer bar */}
                    <div className="db-footer">
                        <div className="db-price-box">
                            <span className="db-price-label">Giá dịch vụ dự kiến:</span>
                            <strong className="db-price-val">
                                {estimating ? '...' : estimatedPrice != null ? formatVnd(estimatedPrice) : '—'}
                            </strong>
                        </div>
                        <div className="db-actions">
                            <button type="button" className="db-btn-secondary" onClick={onClose}>Hủy</button>
                            <button type="submit" className="db-btn-primary" disabled={loading || helperCats.length === 0 || !isDistrictSupported}>
                                {loading ? '...' : 'Đặt thợ ngay'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DirectBookingModal;
