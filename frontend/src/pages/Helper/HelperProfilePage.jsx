import React, { useState, useEffect, useCallback, useRef } from 'react';
import HelperLayout from '../../layouts/HelperLayout';
import ProfileService from '../../services/ProfileService';
import NotificationModal from '../../components/NotificationModal';
import { reverseGeocodeStreet, autocompleteAddressGoong, getPlaceDetailGoong, geocodeAddressGoong } from '../../utils/mapLocationUtils';
import MapGoongComponent from '../../components/MapGoongComponent';
import './HelperProfilePage.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const GENDER_OPTIONS = [
    { value: 'MALE', label: 'Nam' },
    { value: 'FEMALE', label: 'Nữ' },
    { value: 'OTHER', label: 'Khác' },
];

const KYC_STATUS_MAP = {
    // Matches backend KycStatus enum (helper_profile.kyc_status)
    PENDING: { label: 'Chưa xác minh', color: '#64748b', bg: '#f1f5f9' },
    WAITING_APPROVAL: { label: 'Đang chờ duyệt', color: '#d97706', bg: '#fffbeb' },
    VERIFIED: { label: 'Đã xác minh', color: '#16a34a', bg: '#f0fdf4' },
    REJECTED: { label: 'Bị từ chối', color: '#dc2626', bg: '#fef2f2' },
};

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();
};

// Toast → replaced by shared NotificationModal component

// ─── Reusable Select ──────────────────────────────────────────────────────────
const SelectField = ({ id, label, value, onChange, options, placeholder, disabled, required }) => (
    <div className="hpp-field">
        <label className="hpp-label" htmlFor={id}>
            {label} {required && <span className="hpp-required">*</span>}
        </label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`hpp-select ${disabled ? 'hpp-select--disabled' : ''}`}
        >
            <option value="">{placeholder || '-- Chọn --'}</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

// ─── Multi-select Checkboxes ──────────────────────────────────────────────────
const MultiCheckboxField = ({ id, label, options, selectedIds, onChange, loading, emptyText }) => {
    const toggle = (id) => {
        const next = selectedIds.includes(id)
            ? selectedIds.filter((x) => x !== id)
            : [...selectedIds, id];
        onChange(next);
    };

    return (
        <div className="hpp-field">
            <label className="hpp-label">{label}</label>
            {loading ? (
                <div className="hpp-checkbox-loading">
                    <span className="hpp-mini-spinner" />
                    Đang tải...
                </div>
            ) : options.length === 0 ? (
                <div className="hpp-checkbox-empty">{emptyText || 'Không có dữ liệu'}</div>
            ) : (
                <div className="hpp-checkbox-grid" id={id}>
                    {options.map((opt) => (
                        <label
                            key={opt.value}
                            className={`hpp-checkbox-item ${selectedIds.includes(opt.value) ? 'hpp-checkbox-item--checked' : ''}`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(opt.value)}
                                onChange={() => toggle(opt.value)}
                                className="hpp-checkbox-input"
                            />
                            <span className="hpp-checkbox-box" />
                            <span className="hpp-checkbox-label">{opt.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Thông tin cơ bản
// ═══════════════════════════════════════════════════════════════════════════════
const BasicInfoTab = ({ profile, onSaved }) => {
    const [form, setForm] = useState({
        fullName: '',
        avatarUrl: '',
        gender: '',
        addressDetail: '',
        // Store names (strings) — backend expects names, not IDs
        wardName: '',
        districtName: '',
        provinceName: '',
        addressLabel: 'HOME',
        // UI-only: codes for cascading dropdowns
        provinceCode: '',
        districtCode: '',
        wardCode: '',
        latitude: 16.0544, // Default Da Nang
        longitude: 108.2022,
    });

    // Dropdown data
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);
    const [addressLabels, setAddressLabels] = useState([]);

    // Loading states
    const [loadingProv, setLoadingProv] = useState(false);
    const [loadingDist, setLoadingDist] = useState(false);
    const [loadingWard, setLoadingWard] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    // Chỉ auto-geocode khi user thực sự chỉnh sửa địa chỉ,
    // tránh ghi đè tọa độ đã lưu khi vừa reload trang.
    const [hasManualAddressEdit, setHasManualAddressEdit] = useState(false);

    // Address autocomplete
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
    const addressDebounceRef = useRef(null);
    const addressWrapperRef = useRef(null);
    // Khi Goong Place Detail đã trả về tọa độ chính xác, bỏ qua geocoding Nominatim tiếp theo
    const suppressAutoGeocodeRef = useRef(false);

    const toOptions = (arr) =>
        arr.map((item) => ({ value: String(item.code ?? item.id ?? item), label: item.name ?? item }));

    // ── Bootstrap: load provinces + address labels, then cascade districts & wards.
    // Backend UserProfileResponse returns *names* (provinceName, districtName, wardName)
    // We match name→code to pre-select the dropdowns, but store names in form.
    useEffect(() => {
        if (!profile) return;
        setHasManualAddressEdit(false);

        // 1. Seed scalar fields immediately
        setForm((f) => ({
            ...f,
            fullName: profile.fullName || '',
            avatarUrl: profile.avatarUrl || '',
            gender: profile.gender || '',
            addressDetail: profile.addressDetail || '',
            addressLabel: profile.addressLabel || 'HOME',
            provinceName: profile.provinceName || '',
            districtName: profile.districtName || '',
            wardName: profile.wardName || '',
            latitude: profile.latitude || 16.0544,
            longitude: profile.longitude || 108.2022,
        }));

        // 2. Load address-label options
        ProfileService.getAddressLabels()
            .then((res) => setAddressLabels(res.data || []))
            .catch(() => { });

        // 3. Load provinces → resolve province CODE from saved provinceName → cascade
        setLoadingProv(true);
        ProfileService.getProvinces()
            .then(async (res) => {
                const rawProv = res?.data || res;
                const provList = Array.isArray(rawProv) ? rawProv : [];
                setProvinces(toOptions(provList));

                if (!profile.provinceName) return;
                const matchedProv = provList.find((p) => p.name === profile.provinceName);
                if (!matchedProv) return;

                const resolvedProvCode = String(matchedProv.code ?? matchedProv.id);
                setForm((f) => ({ ...f, provinceCode: resolvedProvCode }));

                // --- load & resolve district ---
                setLoadingDist(true);
                try {
                    const dRes = await ProfileService.getDistricts(resolvedProvCode);
                    const payload = dRes?.data ?? dRes;
                    const rawDist = Array.isArray(payload) ? payload : (Array.isArray(payload?.districts) ? payload.districts : []);
                    const distList = rawDist.map((d) => ({ ...d, code: String(d.code) }));
                    setDistricts(toOptions(distList));

                    if (!profile.districtName) return;
                    const matchedDist = distList.find((d) => d.name === profile.districtName);
                    if (!matchedDist) return;

                    const resolvedDistCode = String(matchedDist.code);
                    setForm((f) => ({ ...f, districtCode: resolvedDistCode }));

                    // --- load & resolve ward ---
                    setLoadingWard(true);
                    try {
                        const wRes = await ProfileService.getWards(resolvedDistCode);
                        const wPayload = wRes?.data ?? wRes;
                        const rawWard = Array.isArray(wPayload) ? wPayload : (Array.isArray(wPayload?.wards) ? wPayload.wards : []);
                        const wardList = rawWard.map((w) => ({ ...w, code: String(w.code) }));
                        setWards(toOptions(wardList));

                        if (!profile.wardName) return;
                        const matchedWard = wardList.find((w) => w.name === profile.wardName);
                        if (matchedWard) {
                            setForm((f) => ({ ...f, wardCode: String(matchedWard.code) }));
                        }
                    } catch { /* ignore */ }
                    finally { setLoadingWard(false); }
                } catch { /* ignore */ }
                finally { setLoadingDist(false); }
            })
            .catch(() => { })
            .finally(() => setLoadingProv(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    // Province → Districts (user-initiated change)
    const handleProvinceChange = async (e) => {
        const provCode = e.target.value;
        const provName = provinces.find((p) => p.value === provCode)?.label || '';
        setHasManualAddressEdit(true);
        setForm((f) => ({ ...f, provinceCode: provCode, provinceName: provName, districtCode: '', districtName: '', wardCode: '', wardName: '' }));
        setDistricts([]);
        setWards([]);
        if (!provCode) return;
        setLoadingDist(true);
        try {
            const res = await ProfileService.getDistricts(provCode);
            const payload = res?.data ?? res;
            const rawDist = Array.isArray(payload) ? payload : (Array.isArray(payload?.districts) ? payload.districts : []);
            setDistricts(rawDist.map((d) => ({ value: String(d.code), label: d.name })));
        } catch { /* ignore */ }
        finally { setLoadingDist(false); }
    };

    // District → Wards (user-initiated change)
    const handleDistrictChange = async (e) => {
        const distCode = e.target.value;
        const distName = districts.find((d) => d.value === distCode)?.label || '';
        setHasManualAddressEdit(true);
        setForm((f) => ({ ...f, districtCode: distCode, districtName: distName, wardCode: '', wardName: '' }));
        setWards([]);
        if (!distCode) return;
        setLoadingWard(true);
        try {
            const res = await ProfileService.getWards(distCode);
            const payload = res?.data ?? res;
            const rawWard = Array.isArray(payload) ? payload : (Array.isArray(payload?.wards) ? payload.wards : []);
            setWards(rawWard.map((w) => ({ value: String(w.code), label: w.name })));
        } catch { /* ignore */ }
        finally { setLoadingWard(false); }
    };

    // ── Auto Geocoding với Fallback ─────────────────────────────────────────────
    // Thử geocode với địa chỉ đầy đủ (số nhà) trước, nếu không tìm thấy thì fallback
    // về cấp Phường/Quận/Tỉnh. Nominatim thường không có dữ liệu số nhà ở VN.
    useEffect(() => {
        if (!hasManualAddressEdit) return;
        if (!form.provinceCode) return;

        const timer = setTimeout(async () => {
            // Goong Place Detail đã cung cấp tọa độ chính xác → bỏ qua lần này
            if (suppressAutoGeocodeRef.current) {
                suppressAutoGeocodeRef.current = false;
                return;
            }

            const provinceName = provinces.find(p => p.value == form.provinceCode)?.label;
            const districtName = districts.find(d => d.value == form.districtCode)?.label;
            const wardName = wards.find(w => w.value == form.wardCode)?.label;
            const street = form.addressDetail?.trim() || null;

            const result = await geocodeAddressGoong({ street, wardName, districtName, provinceName });
            if (result) {
                setForm(prev => ({
                    ...prev,
                    latitude: result.lat,
                    longitude: result.lng,
                }));
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [hasManualAddressEdit, form.provinceCode, form.districtCode, form.wardCode, form.addressDetail, provinces, districts, wards]);

    const handleMapLocationChange = (latlng) => {
        const { lat, lng } = latlng;
        setHasManualAddressEdit(false);

        setForm((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lng,
        }));

        // Reverse geocode để lấy luôn địa chỉ chi tiết từ tọa độ map
        // và gửi đầy đủ lên backend khi submit.
        (async () => {
            try {
                const street = await reverseGeocodeStreet({ lat, lng });

                setForm((prev) => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                    addressDetail: street || prev.addressDetail,
                }));
            } catch (err) {
                console.error('Reverse geocoding failed:', err);
            }
        })();
    };

    // Close address suggestion dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (addressWrapperRef.current && !addressWrapperRef.current.contains(e.target)) {
                setShowAddressSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'addressDetail') {
            setHasManualAddressEdit(true);
            setForm((f) => ({ ...f, addressDetail: value }));

            if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
            if (value.trim().length > 2) {
                addressDebounceRef.current = setTimeout(async () => {
                    const suggestions = await autocompleteAddressGoong(value, {
                        lat: form.latitude,
                        lng: form.longitude,
                    });
                    setAddressSuggestions(suggestions);
                    setShowAddressSuggestions(suggestions.length > 0);
                }, 350);
            } else {
                setAddressSuggestions([]);
                setShowAddressSuggestions(false);
            }
            return;
        }
        setForm((f) => ({ ...f, [name]: value }));
    };

    const handleSelectAddressSuggestion = async (suggestion) => {
        const streetOnly = suggestion.structured_formatting?.main_text || suggestion.description;
        setForm((f) => ({ ...f, addressDetail: streetOnly }));
        setShowAddressSuggestions(false);
        setAddressSuggestions([]);
        setHasManualAddressEdit(true);

        if (suggestion.place_id) {
            try {
                const coords = await getPlaceDetailGoong(suggestion.place_id);
                if (coords) {
                    suppressAutoGeocodeRef.current = true;
                    setForm((f) => ({ ...f, latitude: coords.lat, longitude: coords.lng }));
                }
            } catch (err) {
                console.error('Place detail geocoding failed:', err);
            }
        }
    };

    // Resize + compress ảnh bằng Canvas trước khi lưu base64
    // → giữ kích thước nhỏ (~20-50KB) phù hợp với DB TEXT column
    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setToast({ message: 'Vui lòng chọn file ảnh (jpg, png, webp...)', type: 'error' });
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setToast({ message: 'Ảnh không được vượt quá 10MB', type: 'error' });
            return;
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
            // Resize về tối đa 300×300px
            const MAX = 300;
            let { width, height } = img;
            if (width > height) {
                if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
            } else {
                if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);

            // Compress sang JPEG quality 0.75 (~20-60KB)
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            setForm((f) => ({ ...f, avatarUrl: compressed }));
            URL.revokeObjectURL(objectUrl);
        };
        img.onerror = () => {
            setToast({ message: 'Không thể đọc file ảnh', type: 'error' });
            URL.revokeObjectURL(objectUrl);
        };
        img.src = objectUrl;

        // Reset input để có thể chọn lại cùng file
        e.target.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.fullName.trim()) {
            setToast({ message: 'Họ tên không được để trống', type: 'error' });
            return;
        }
        setSaving(true);
        try {
            // Resolve ward name if user just changed ward dropdown
            const wardName = form.wardCode
                ? (wards.find((w) => w.value === form.wardCode)?.label || form.wardName)
                : form.wardName;
            const payload = {
                fullName: form.fullName,
                avatarUrl: form.avatarUrl || null,
                gender: form.gender || null,
                addressDetail: form.addressDetail || null,
                wardName: wardName || null,
                districtName: form.districtName || null,
                provinceName: form.provinceName || null,
                addressLabel: form.addressLabel || 'HOME',
                latitude: form.latitude,
                longitude: form.longitude,
            };
            await ProfileService.updateProfile(payload);

            // Sync vào localStorage
            try {
                const stored = JSON.parse(localStorage.getItem('user') || '{}');
                if (form.avatarUrl !== undefined) stored.avatarUrl = form.avatarUrl;
                if (form.fullName) stored.fullName = form.fullName;
                localStorage.setItem('user', JSON.stringify(stored));
            } catch { /* ignore */ }

            // Báo cho Header biết cần reload (cùng tab → dùng CustomEvent)
            window.dispatchEvent(new CustomEvent('profile:updated'));

            setToast({ message: 'Cập nhật thông tin thành công!', type: 'success' });
            onSaved?.();
        } catch (err) {
            setToast({
                message: err?.message || 'Có lỗi xảy ra, vui lòng thử lại',
                type: 'error',
            });
        } finally {
            setSaving(false);
        }
    };

    // kycStatus comes from helper_profile (HelperProfileResponse), not UserProfileResponse
    // Use profile.kycStatus if available (merged by main page), fallback PENDING
    const kyc = KYC_STATUS_MAP[profile?.kycStatus] || KYC_STATUS_MAP['PENDING'];

    return (
        <div className="hpp-tab-content">
            {toast && <NotificationModal message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Avatar card – click avatar to change photo */}
            <div className="hpp-avatar-card">
                {/* Hidden file input */}
                <input
                    id="avatar-file-input"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarChange}
                />

                {/* Clickable avatar */}
                <div
                    className="hpp-avatar-circle hpp-avatar-circle--clickable"
                    onClick={() => document.getElementById('avatar-file-input').click()}
                    title="Nhấn để đổi ảnh đại diện"
                >
                    {form.avatarUrl
                        ? <img src={form.avatarUrl} alt="Avatar" className="hpp-avatar-img" />
                        : <span className="hpp-avatar-initials">{getInitials(form.fullName)}</span>
                    }
                    {/* Overlay camera icon */}
                    <div className="hpp-avatar-overlay">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span>Đổi ảnh</span>
                    </div>
                </div>

                <div className="hpp-avatar-info">
                    <h2 className="hpp-avatar-name">{profile?.fullName || '—'}</h2>
                    <p className="hpp-avatar-email">{profile?.email || '—'}</p>
                    <span className="hpp-kyc-badge" style={{ color: kyc.color, backgroundColor: kyc.bg }}>
                        {kyc.label}
                    </span>
                </div>
                {profile?.phone && (
                    <div className="hpp-avatar-phone">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 14 19.79 19.79 0 0 1 1.07 5.4 2 2 0 0 1 3.04 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 18z" />
                        </svg>
                        <span>{profile.phone}</span>
                    </div>
                )}
            </div>

            <form className="hpp-form" onSubmit={handleSubmit}>

                {/* ── Thông tin cơ bản ── */}
                <div className="hpp-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Thông tin cơ bản</span>
                </div>

                <div className="hpp-form-row hpp-form-row--2">
                    <div className="hpp-field">
                        <label className="hpp-label" htmlFor="basic-fullName">
                            Họ và tên <span className="hpp-required">*</span>
                        </label>
                        <input
                            id="basic-fullName"
                            type="text"
                            name="fullName"
                            value={form.fullName}
                            onChange={handleChange}
                            className="hpp-input"
                            placeholder="Nguyễn Văn A"
                        />
                    </div>
                    <SelectField
                        id="basic-gender"
                        label="Giới tính"
                        value={form.gender}
                        onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                        options={GENDER_OPTIONS}
                        placeholder="-- Chọn giới tính --"
                    />
                </div>

                <div className="hpp-form-row hpp-form-row--2">
                    <div className="hpp-field">
                        <label className="hpp-label">Email</label>
                        <input type="text" value={profile?.email || ''} className="hpp-input hpp-input--readonly" readOnly />
                    </div>
                    <div className="hpp-field">
                        <label className="hpp-label">Số điện thoại</label>
                        <input type="text" value={profile?.phone || ''} className="hpp-input hpp-input--readonly" readOnly />
                    </div>
                </div>


                {/* ── Địa chỉ ── */}
                <div className="hpp-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>Địa chỉ liên lạc</span>
                </div>



                <div className="hpp-form-row hpp-form-row--3">
                    <div className="hpp-field">
                        <label className="hpp-label" htmlFor="basic-province">Tỉnh / Thành phố</label>
                        <select
                            id="basic-province"
                            value={form.provinceCode}
                            onChange={handleProvinceChange}
                            disabled={loadingProv}
                            className={`hpp-select ${loadingProv ? 'hpp-select--disabled' : ''}`}
                        >
                            <option value="">{loadingProv ? 'Đang tải...' : '-- Chọn Tỉnh/TP --'}</option>
                            {provinces.map((p) => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Quận/Huyện */}
                    <div className="hpp-field">
                        <label className="hpp-label" htmlFor="basic-district">Quận / Huyện</label>
                        <select
                            id="basic-district"
                            value={form.districtCode}
                            onChange={handleDistrictChange}
                            disabled={!form.provinceCode || loadingDist}
                            className={`hpp-select ${(!form.provinceCode || loadingDist) ? 'hpp-select--disabled' : ''}`}
                        >
                            <option value="">
                                {loadingDist ? 'Đang tải...' : !form.provinceCode ? '-- Chọn Tỉnh/TP trước --' : '-- Chọn Quận/Huyện --'}
                            </option>
                            {districts.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Phường/Xã */}
                    <div className="hpp-field">
                        <label className="hpp-label" htmlFor="basic-ward">Phường / Xã</label>
                        <select
                            id="basic-ward"
                            value={form.wardCode}
                            onChange={(e) => {
                                const wardCode = e.target.value;
                                const wardName = wards.find((w) => w.value === wardCode)?.label || '';
                                setHasManualAddressEdit(true);
                                setForm((f) => ({ ...f, wardCode, wardName }));
                            }}
                            disabled={!form.districtCode || loadingWard}
                            className={`hpp-select ${(!form.districtCode || loadingWard) ? 'hpp-select--disabled' : ''}`}
                        >
                            <option value="">
                                {loadingWard ? 'Đang tải...' : !form.districtCode ? '-- Chọn Quận/Huyện trước --' : '-- Chọn Phường/Xã --'}
                            </option>
                            {wards.map((w) => (
                                <option key={w.value} value={w.value}>{w.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Nhãn địa chỉ */}
                <div className="hpp-form-row hpp-form-row--2">
                    <div className="hpp-field">
                        <label className="hpp-label" htmlFor="basic-addressLabel">Nhãn địa chỉ</label>
                        <select
                            id="basic-addressLabel"
                            name="addressLabel"
                            value={form.addressLabel}
                            onChange={handleChange}
                            className="hpp-select"
                        >
                            {addressLabels.length === 0
                                ? <option value="HOME">HOME</option>
                                : addressLabels.map((lb) => (
                                    <option key={lb} value={lb}>{lb}</option>
                                ))
                            }
                        </select>
                    </div>
                    <div className="hpp-field">
                        <label className="hpp-label" htmlFor="basic-addressDetail">Địa chỉ chi tiết</label>
                        <div className="hpp-autocomplete-wrapper" ref={addressWrapperRef}>
                            <input
                                id="basic-addressDetail"
                                type="text"
                                name="addressDetail"
                                value={form.addressDetail}
                                onChange={handleChange}
                                onFocus={() => addressSuggestions.length > 0 && setShowAddressSuggestions(true)}
                                className="hpp-input"
                                placeholder="Số nhà, tên đường..."
                                autoComplete="off"
                            />
                            {showAddressSuggestions && addressSuggestions.length > 0 && (
                                <ul className="hpp-autocomplete-list">
                                    {addressSuggestions.map((s) => (
                                        <li
                                            key={s.place_id}
                                            className="hpp-autocomplete-item"
                                            onMouseDown={() => handleSelectAddressSuggestion(s)}
                                        >
                                            <svg className="hpp-autocomplete-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span>{s.structured_formatting?.main_text || s.description}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bản đồ chọn vị trí */}
                <div className="hpp-field" style={{ marginTop: '1rem' }}>
                    <label className="hpp-label" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        Ghim vị trí chính xác
                    </label>
                    <div style={{ height: '300px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #e2e8f0', zIndex: 1 }}>
                        <MapGoongComponent
                            latitude={form.latitude}
                            longitude={form.longitude}
                            onLocationChange={handleMapLocationChange}
                            height="300px"
                        />
                    </div>
                </div>

                {/* Địa chỉ hiện tại */}
                {(profile?.wardName || profile?.districtName || profile?.provinceName) && (
                    <div className="hpp-current-address">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>
                            Địa chỉ hiện tại:&nbsp;
                            <strong>
                                {[profile.addressDetail, profile.wardName, profile.districtName, profile.provinceName]
                                    .filter(Boolean).join(', ')}
                            </strong>
                        </span>
                    </div>
                )}
                <div className="hpp-form-actions">
                    <button id="basic-save-btn" type="submit" className="hpp-btn hpp-btn--primary" disabled={saving}>
                        {saving ? (
                            <><span className="hpp-spinner" />Đang lưu...</>
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Lưu thay đổi
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Hồ sơ nghề nghiệp
// ═══════════════════════════════════════════════════════════════════════════════
const ProfessionalProfileTab = () => {
    const [profile, setProfile] = useState(null);
    const [loadingInit, setLoadingInit] = useState(true);

    // Master data
    const [allProvinces, setAllProvinces] = useState([]);
    const [allWorkDistricts, setAllWorkDistricts] = useState([]);
    const [allServices, setAllServices] = useState([]);

    const [loadingProv, setLoadingProv] = useState(false);
    const [loadingWorkDist, setLoadingWorkDist] = useState(false);
    const [loadingSvc, setLoadingSvc] = useState(false);

    const [form, setForm] = useState({
        bio: '',
        experienceYears: 0,
        dateOfBirth: '',
        hometownName: '',          // sent as hometownName to backend
        workProvinceCode: '',      // UI-only: filter for working districts
        workingDistricts: [],      // array of { code, name } objects
        categoryIds: [],
    });

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const toOptionsArr = (res) => {
        const arr = Array.isArray(res) ? res : (res?.data || []);
        return arr.map((item) => ({ value: String(item.code ?? item.id ?? item), label: item.name ?? item }));
    };

    // ── Bootstrap: fetch profile + master data ────────────────────────────────
    const fetchProfile = useCallback(() => {
        setLoadingInit(true);
        ProfileService.getHelperProfessionalProfile()
            .then((res) => {
                const data = res.data;
                if (!data) return;
                setProfile(data);
                setForm((f) => ({
                    ...f,
                    bio: data.bio || '',
                    experienceYears: data.experienceYears ?? 0,
                    dateOfBirth: data.dateOfBirth || '',
                    hometownName: data.hometownName || '',
                    // workingDistricts from backend: [{ code, name, type }]
                    workingDistricts: data.workingDistricts?.map((d) => ({ code: String(d.code), name: d.name })) || [],
                    categoryIds: data.categories?.map((c) => String(c.id ?? c.categoryId)).filter(Boolean) || [],
                }));
            })
            .catch((err) => console.error('[ProfessionalTab] fetch failed:', err))
            .finally(() => setLoadingInit(false));
    }, []);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    // Load provinces once
    useEffect(() => {
        setLoadingProv(true);
        ProfileService.getProvinces()
            .then((res) => {
                const data = res?.data || res;
                const arr = Array.isArray(data) ? data : [];
                setAllProvinces(arr.map((p) => ({ value: String(p.code), label: p.name })));
            })
            .catch(() => { })
            .finally(() => setLoadingProv(false));
    }, []);

    // Load active categories once
    useEffect(() => {
        setLoadingSvc(true);
        ProfileService.getActiveCategories()
            .then((res) => {
                const payload = res?.data ?? res;
                const arr = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.data)
                        ? payload.data
                        : [];
                const categories = arr
                    .map((cat) => ({
                        value: String(cat?.id ?? cat?.categoryId ?? ''),
                        label: cat?.name || cat?.categoryName || 'Danh mục dịch vụ',
                    }))
                    .filter((cat) => cat.value && cat.label);

                setAllServices(categories);
            })
            .catch(() => { })
            .finally(() => setLoadingSvc(false));
    }, []);

    // When workingDistricts loaded from profile, detect workProvinceCode
    // by finding first saved district's code in each province's district list
    useEffect(() => {
        if (!form.workingDistricts.length || !allProvinces.length) return;
        if (form.workProvinceCode) return; // already set

        const firstCode = form.workingDistricts[0]?.code;
        if (!firstCode) return;
        let cancelled = false;

        (async () => {
            for (const prov of allProvinces) {
                if (cancelled) break;
                try {
                    const res = await ProfileService.getDistricts(prov.value);
                    const payload = res?.data ?? res;
                    const dists = Array.isArray(payload) ? payload : (Array.isArray(payload?.districts) ? payload.districts : []);
                    const found = dists.some((d) => String(d.code) === String(firstCode));
                    if (found && !cancelled) {
                        setForm((f) => ({ ...f, workProvinceCode: prov.value }));
                        setAllWorkDistricts(
                            dists.map((d) => ({ value: String(d.code), label: d.name }))
                        );
                        break;
                    }
                } catch { /* ignore */ }
            }
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.workingDistricts, allProvinces]);

    // When user manually changes the work-province filter
    const handleWorkProvinceChange = async (e) => {
        const provCode = e.target.value;
        setForm((f) => ({ ...f, workProvinceCode: provCode }));
        setAllWorkDistricts([]);
        if (!provCode) return;
        setLoadingWorkDist(true);
        try {
            const res = await ProfileService.getDistricts(provCode);
            const payload = res?.data ?? res;
            const dists = Array.isArray(payload) ? payload : (Array.isArray(payload?.districts) ? payload.districts : []);
            setAllWorkDistricts(dists.map((d) => ({ value: String(d.code), label: d.name })));
        } catch { /* ignore */ }
        finally { setLoadingWorkDist(false); }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.bio || form.bio.trim().length < 50) {
            setToast({ message: 'Bio phải có ít nhất 50 ký tự', type: 'error' });
            return;
        }
        setSaving(true);
        try {
            const hometownName = form.hometownName
                || allProvinces.find((p) => p.value === form.workProvinceCode)?.label
                || '';
            const payload = {
                bio: form.bio,
                experienceYears: parseInt(form.experienceYears, 10) || 0,
                dateOfBirth: form.dateOfBirth || null,
                hometownName: hometownName || null,
                // Backend expects: List<WorkingDistrictRequest> with { name, code }
                workingDistricts: form.workingDistricts,
                categoryIds: form.categoryIds.map((id) => parseInt(id, 10)),
            };
            await ProfileService.updateHelperProfessionalProfile(payload);
            setToast({ message: 'Cập nhật hồ sơ nghề nghiệp thành công!', type: 'success' });
            fetchProfile();
        } catch (err) {
            setToast({
                message: err?.message || 'Có lỗi xảy ra, vui lòng thử lại',
                type: 'error',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loadingInit) {
        return (
            <div className="hpp-loading-state">
                <div className="hpp-loading-spinner" />
                <p>Đang tải hồ sơ nghề nghiệp...</p>
            </div>
        );
    }

    const selectedCategoryIds = form.categoryIds || [];

    return (
        <div className="hpp-tab-content">
            {toast && <NotificationModal message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Stats row */}
            {profile && (
                <div className="hpp-stats-row">
                    <div className="hpp-stat-card">
                        <span className="hpp-stat-value">{profile.ratingAverage?.toFixed(1) || '—'}</span>
                        <div className="hpp-stat-stars">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <svg key={s} viewBox="0 0 24 24"
                                    fill={s <= Math.round(profile.ratingAverage || 0) ? '#f59e0b' : 'none'}
                                    stroke="#f59e0b" strokeWidth="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                            ))}
                        </div>
                        <span className="hpp-stat-label">Đánh giá TB</span>
                    </div>
                    <div className="hpp-stat-card">
                        <span className="hpp-stat-value">{profile.totalReviews ?? 0}</span>
                        <span className="hpp-stat-label">Lượt đánh giá</span>
                    </div>
                    <div className="hpp-stat-card">
                        <span className="hpp-stat-value">{profile.experienceYears ?? 0}</span>
                        <span className="hpp-stat-label">Năm kinh nghiệm</span>
                    </div>
                    <div className="hpp-stat-card">
                        <span className="hpp-stat-online" style={{ color: profile.isOnline ? '#16a34a' : '#64748b' }}>
                            <span className="hpp-dot" style={{ background: profile.isOnline ? '#16a34a' : '#94a3b8' }} />
                            {profile.isOnline ? 'Online' : 'Offline'}
                        </span>
                        <span className="hpp-stat-label">Trạng thái</span>
                    </div>
                </div>
            )}

            <form className="hpp-form" onSubmit={handleSubmit}>

                {/* ── Bio ── */}
                <div className="hpp-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>Giới thiệu nghề nghiệp</span>
                </div>

                <div className="hpp-field">
                    <label className="hpp-label" htmlFor="prof-bio">
                        Bio <span className="hpp-required">*</span>
                        <span className={`hpp-char-count ${form.bio.length < 50 ? 'hpp-char-count--warn' : 'hpp-char-count--ok'}`}>
                            {form.bio.length} ký tự
                            {form.bio.length < 50 && ` · cần thêm ${50 - form.bio.length}`}
                        </span>
                    </label>
                    <textarea
                        id="prof-bio"
                        name="bio"
                        value={form.bio}
                        onChange={handleChange}
                        className="hpp-textarea"
                        rows={5}
                        placeholder="Mô tả kinh nghiệm, kỹ năng và phong cách làm việc của bạn... (ít nhất 50 ký tự)"
                    />
                </div>

                {/* ── Thông tin nghề nghiệp ── */}
                <div className="hpp-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    <span>Thông tin nghề nghiệp</span>
                </div>

                <div className="hpp-form-row hpp-form-row--2">
                    <div className="hpp-field">
                        <label className="hpp-label" htmlFor="prof-exp">Số năm kinh nghiệm</label>
                        <input
                            id="prof-exp"
                            type="number"
                            name="experienceYears"
                            value={form.experienceYears}
                            onChange={handleChange}
                            min="0" max="50"
                            className="hpp-input"
                        />
                    </div>
                    <div className="hpp-field">
                        <label className="hpp-label" htmlFor="prof-dob">Ngày sinh</label>
                        <input
                            id="prof-dob"
                            type="date"
                            name="dateOfBirth"
                            value={form.dateOfBirth}
                            onChange={handleChange}
                            className="hpp-input"
                        />
                    </div>
                </div>

                {/* ── Quê quán ── */}
                <div className="hpp-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span>Quê quán</span>
                    {profile?.hometownName && (
                        <span className="hpp-hometown-tag">Hiện tại: {profile.hometownName}</span>
                    )}
                </div>

                <div className="hpp-field">
                    <label className="hpp-label" htmlFor="prof-hometown">Tỉnh / Thành phố quê quán</label>
                    <select
                        id="prof-hometown"
                        name="hometownName"
                        value={form.hometownName}
                        onChange={(e) => {
                            const name = e.target.value;
                            setForm((f) => ({ ...f, hometownName: name }));
                        }}
                        disabled={loadingProv}
                        className={`hpp-select ${loadingProv ? 'hpp-select--disabled' : ''}`}
                    >
                        <option value="">{loadingProv ? 'Đang tải...' : '-- Chọn Tỉnh/TP quê quán --'}</option>
                        {allProvinces.map((p) => (
                            <option key={p.value} value={p.label}>{p.label}</option>
                        ))}
                    </select>
                </div>

                {/* ── Khu vực nhận việc ── */}
                <div className="hpp-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    <span>Khu vực nhận việc</span>
                    {form.workingDistricts.length > 0 && (
                        <span className="hpp-selected-count">{form.workingDistricts.length} quận/huyện đã chọn</span>
                    )}
                </div>

                {/* Filter: chọn tỉnh để load danh sách quận */}
                <div className="hpp-field">
                    <label className="hpp-label" htmlFor="prof-workProv">Lọc theo Tỉnh / Thành phố</label>
                    <select
                        id="prof-workProv"
                        value={form.workProvinceCode}
                        onChange={handleWorkProvinceChange}
                        disabled={loadingProv || loadingWorkDist}
                        className={`hpp-select ${(loadingProv || loadingWorkDist) ? 'hpp-select--disabled' : ''}`}
                    >
                        <option value="">
                            {loadingProv ? 'Đang tải...' : loadingWorkDist ? 'Đang tải quận/huyện...' : '-- Chọn Tỉnh/TP để xem quận/huyện --'}
                        </option>
                        {allProvinces.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>

                <MultiCheckboxField
                    id="prof-workDistricts"
                    label="Chọn Quận / Huyện nhận việc"
                    options={allWorkDistricts}
                    selectedIds={form.workingDistricts.map((d) => d.code)}
                    onChange={(codes) => {
                        // Build workingDistricts array of {code, name}
                        const updated = codes.map((code) => {
                            const found = allWorkDistricts.find((d) => d.value === code);
                            // Preserve existing entry or create new one
                            return found
                                ? { code, name: found.label }
                                : form.workingDistricts.find((d) => d.code === code) || { code, name: '' };
                        });
                        setForm((f) => ({ ...f, workingDistricts: updated }));
                    }}
                    loading={loadingWorkDist}
                    emptyText={form.workProvinceCode ? 'Không có quận/huyện nào' : 'Chọn Tỉnh/TP ở trên để xem danh sách'}
                />

                {/* ── Dịch vụ ── */}
                <div className="hpp-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                    <span>Dịch vụ cung cấp</span>
                    <span className="hpp-selected-count">{selectedCategoryIds.length} danh mục đã chọn</span>
                </div>

                <MultiCheckboxField
                    id="prof-services"
                    label="Chọn các dịch vụ lớn bạn cung cấp"
                    options={allServices}
                    selectedIds={selectedCategoryIds}
                    onChange={(categoryIds) =>
                        setForm((f) => ({
                            ...f,
                            categoryIds,
                        }))
                    }
                    loading={loadingSvc}
                    emptyText="Không có danh mục dịch vụ nào"
                />

                <div className="hpp-form-actions">
                    <button id="prof-save-btn" type="submit" className="hpp-btn hpp-btn--primary" disabled={saving}>
                        {saving ? (
                            <><span className="hpp-spinner" />Đang lưu...</>
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                                Lưu hồ sơ nghề nghiệp
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
    { id: 'basic', label: 'Thông tin cơ bản', icon: 'user' },
    { id: 'professional', label: 'Hồ sơ nghề nghiệp', icon: 'briefcase' },
];

const TabIcon = ({ name }) => {
    if (name === 'user')
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
        );
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
    );
};

const HelperProfilePage = () => {
    const [activeTab, setActiveTab] = useState('basic');
    const [basicProfile, setBasicProfile] = useState(null);
    const [loadingBasic, setLoadingBasic] = useState(true);

    const fetchBasic = useCallback((isBackground = false) => {
        if (!isBackground) setLoadingBasic(true);
        // Fetch both basic profile AND helper professional profile (for kycStatus)
        Promise.all([
            ProfileService.getMyProfile(),
            ProfileService.getHelperProfessionalProfile(),
        ])
            .then(([basicRes, helperRes]) => {
                const basic = basicRes.data || null;
                const helper = helperRes.data || null;
                // Merge kycStatus from helper_profile into basic profile object
                if (basic && helper?.kycStatus) {
                    basic.kycStatus = helper.kycStatus;
                }
                setBasicProfile(basic);

                // Sync avatar + fullName vào localStorage → Header hiển thị ngay
                if (basic) {
                    try {
                        const stored = JSON.parse(localStorage.getItem('user') || '{}');
                        if (basic.avatarUrl !== undefined) stored.avatarUrl = basic.avatarUrl;
                        if (basic.fullName) stored.fullName = basic.fullName;
                        localStorage.setItem('user', JSON.stringify(stored));
                    } catch { /* ignore */ }
                }
            })
            .catch((err) => {
                console.error('[HelperProfilePage] fetchBasic failed:', err);
            })
            .finally(() => {
                if (!isBackground) setLoadingBasic(false);
            });
    }, []);

    useEffect(() => { fetchBasic(); }, [fetchBasic]);

    return (
        <HelperLayout>
            <div className="hpp-page">
                {/* Page header */}
                <div className="hpp-page-header">
                    <div className="hpp-page-header">
                        <h1 className="hpp-page-title">Hồ sơ cá nhân</h1>
                        <p className="hpp-page-subtitle">Quản lý thông tin cá nhân và hồ sơ nghề nghiệp của bạn</p>
                    </div>

                </div>

                {/* Tabs */}
                <div className="hpp-tabs" role="tablist">
                    {TABS.map((tab, idx) => (
                        <button
                            key={tab.id}
                            id={`tab-${tab.id}`}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={`hpp-tab-btn ${activeTab === tab.id ? 'hpp-tab-btn--active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <TabIcon name={tab.icon} />
                            {tab.label}
                        </button>
                    ))}
                    <div
                        className="hpp-tab-indicator"
                        style={{
                            transform: `translateX(${TABS.findIndex((t) => t.id === activeTab) * 100}%)`,
                            width: `${100 / TABS.length}%`,
                        }}
                    />
                </div>

                {/* Tab panels */}
                <div className="hpp-panel">
                    {activeTab === 'basic' && (
                        loadingBasic
                            ? <div className="hpp-loading-state"><div className="hpp-loading-spinner" /><p>Đang tải thông tin...</p></div>
                            : <BasicInfoTab profile={basicProfile} onSaved={() => fetchBasic(true)} />
                    )}
                    {activeTab === 'professional' && <ProfessionalProfileTab />}
                </div>
            </div>
        </HelperLayout>
    );
};

export default HelperProfilePage;
