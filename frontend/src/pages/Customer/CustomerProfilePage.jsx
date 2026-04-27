import React, { useState, useEffect, useCallback, useRef } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import ProfileService from '../../services/ProfileService';
import HelperRegistrationService from '../../services/HelperRegistrationService';
import CloudinaryService from '../../services/CloudinaryService';
import NotificationModal from '../../components/NotificationModal';
import { reverseGeocodeStreet, autocompleteAddressGoong, getPlaceDetailGoong, geocodeAddressGoong } from '../../utils/mapLocationUtils';
import MapGoongComponent from '../../components/MapGoongComponent';
import './CustomerProfilePage.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const GENDER_OPTIONS = [
    { value: 'MALE', label: 'Nam' },
    { value: 'FEMALE', label: 'Nữ' },
    { value: 'OTHER', label: 'Khác' },
];

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();
};

// Toast → replaced by shared NotificationModal component

// ─── Reusable Select ──────────────────────────────────────────────────────────
const SelectField = ({ id, label, value, onChange, options, placeholder, disabled, required }) => (
    <div className="cpp-field">
        <label className="cpp-label" htmlFor={id}>
            {label} {required && <span className="cpp-required">*</span>}
        </label>
        <select
            id={id}
            value={value}
            onChange={onChange}
            disabled={disabled}
            className={`cpp-select ${disabled ? 'cpp-select--disabled' : ''}`}
        >
            <option value="">{placeholder || '-- Chọn --'}</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE: Customer Profile
// ═══════════════════════════════════════════════════════════════════════════════
const CustomerProfilePage = () => {
    const [profile, setProfile] = useState(null);
    const [loadingBasic, setLoadingBasic] = useState(true);

    const [form, setForm] = useState({
        fullName: '',
        avatarUrl: '',
        gender: '',
        addressDetail: '',
        // Backend expects names, not IDs
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

    // Loading states for dropdowns & saving
    const [loadingProv, setLoadingProv] = useState(false);
    const [loadingDist, setLoadingDist] = useState(false);
    const [loadingWard, setLoadingWard] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [toast, setToast] = useState(null);
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

    // Fetch Profile
    const fetchBasic = useCallback((isBackground = false) => {
        if (!isBackground) setLoadingBasic(true);
        ProfileService.getMyProfile()
            .then((res) => {
                const basic = res.data || null;
                setProfile(basic);

                // Sync avatar + fullName vào localStorage
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
                console.error('[CustomerProfilePage] fetchBasic failed:', err);
                setToast({ message: 'Không thể tải thông tin cá nhân', type: 'error' });
            })
            .finally(() => {
                if (!isBackground) setLoadingBasic(false);
            });
    }, []);

    useEffect(() => { fetchBasic(); }, [fetchBasic]);

    // Populate dropdowns once profile is loaded
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

        // 3. Load provinces → resolve CODE from saved provinceName → cascade
        setLoadingProv(true);
        ProfileService.getProvinces()
            .then(async (res) => {
                const raw = res?.data || res;
                const provList = Array.isArray(raw) ? raw : [];
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
                    const dPayload = dRes?.data ?? dRes;
                    const rawDist = Array.isArray(dPayload) ? dPayload : (Array.isArray(dPayload?.districts) ? dPayload.districts : []);
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
        setForm((f) => ({
            ...f,
            provinceCode: provCode,
            provinceName: provName,
            districtCode: '',
            districtName: '',
            wardCode: '',
            wardName: '',
            addressDetail: '',
        }));
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
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

    // ── Auto Geocoding bằng Goong (chính xác cho địa chỉ VN) ───────────────────
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
        setForm(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
        }));

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

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input để có thể chọn lại cùng file
        e.target.value = '';

        if (!file.type.startsWith('image/')) {
            setToast({ message: 'Vui lòng chọn file ảnh (jpg, png, webp...)', type: 'error' });
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setToast({ message: 'Ảnh không được vượt quá 10MB', type: 'error' });
            return;
        }

        try {
            setUploadingAvatar(true);
            const url = await CloudinaryService.uploadImage(file, 'avatars');
            setForm((f) => ({ ...f, avatarUrl: url }));
        } catch (err) {
            setToast({ message: err?.message || 'Tải ảnh lên thất bại, vui lòng thử lại', type: 'error' });
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.fullName.trim()) {
            setToast({ message: 'Họ tên không được để trống', type: 'error' });
            return;
        }
        if (!form.addressDetail.trim()) {
            setToast({ message: 'Vui lòng nhập địa chỉ chi tiết để cập nhật', type: 'error' });
            return;
        }
        setSaving(true);
        try {
            // Resolve ward name if user just switched the ward dropdown
            const wardName = form.wardCode
                ? (wards.find((w) => w.value === form.wardCode)?.label || form.wardName)
                : form.wardName;
            const payload = {
                fullName: form.fullName,
                avatarUrl: form.avatarUrl || null,
                gender: form.gender || null,
                addressDetail: form.addressDetail || null,
                wardName: wardName || null,
                wardCode: form.wardCode || null,
                districtName: form.districtName || null,
                districtCode: form.districtCode || null,
                provinceName: form.provinceName || null,
                provinceCode: form.provinceCode || null,
                addressLabel: form.addressLabel || 'HOME',
                latitude: form.latitude,
                longitude: form.longitude,
            };
            await ProfileService.updateProfile(payload);

            try {
                const stored = JSON.parse(localStorage.getItem('user') || '{}');
                if (form.avatarUrl !== undefined) stored.avatarUrl = form.avatarUrl;
                if (form.fullName) stored.fullName = form.fullName;
                localStorage.setItem('user', JSON.stringify(stored));
            } catch { /* ignore */ }

            window.dispatchEvent(new CustomEvent('profile:updated'));

            setToast({ message: 'Cập nhật thông tin thành công!', type: 'success' });
            fetchBasic(true);
        } catch (err) {
            setToast({
                message: err?.message || 'Có lỗi xảy ra, vui lòng thử lại',
                type: 'error',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <CustomerLayout>
            <div className="cpp-page">
                {/* Page header */}
                <div className="cpp-page-header">
                    <div className="cpp-page-header-left">
                        <h1 className="cpp-page-title">Hồ sơ cá nhân</h1>
                        <p className="cpp-page-subtitle">Quản lý các thông tin cá nhân và liên lạc của bạn</p>
                    </div>
                </div>

                <div className="cpp-panel">
                    {loadingBasic ? (
                        <div className="cpp-loading-state">
                            <div className="cpp-loading-spinner" />
                            <p>Đang tải thông tin...</p>
                        </div>
                    ) : (
                        <div className="cpp-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                            {toast && <NotificationModal message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                            {/* Avatar card (No KYC badge) */}
                            <div className="cpp-avatar-card">
                                <input
                                    id="avatar-file-input"
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleAvatarChange}
                                />
                                <div
                                    className="cpp-avatar-circle cpp-avatar-circle--clickable"
                                    onClick={() => !uploadingAvatar && document.getElementById('avatar-file-input').click()}
                                    title={uploadingAvatar ? 'Đang tải ảnh...' : 'Nhấn để đổi ảnh đại diện'}
                                    style={{ cursor: uploadingAvatar ? 'wait' : 'pointer' }}
                                >
                                    {form.avatarUrl
                                        ? <img src={form.avatarUrl} alt="Avatar" className="cpp-avatar-img" style={{ opacity: uploadingAvatar ? 0.5 : 1 }} />
                                        : <span className="cpp-avatar-initials">{getInitials(form.fullName)}</span>
                                    }
                                    <div className="cpp-avatar-overlay">
                                        {uploadingAvatar ? (
                                            <>
                                                <span className="cpp-spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff', width: 22, height: 22 }} />
                                                <span>Đang tải...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                    <circle cx="12" cy="13" r="4" />
                                                </svg>
                                                <span>Đổi ảnh</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="cpp-avatar-info">
                                    <h2 className="cpp-avatar-name">{profile?.fullName || '—'}</h2>
                                    <p className="cpp-avatar-email">{profile?.email || '—'}</p>

                                </div>
                                {profile?.phone && (
                                    <div className="cpp-avatar-phone">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 14 19.79 19.79 0 0 1 1.07 5.4 2 2 0 0 1 3.04 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 18z" />
                                        </svg>
                                        <span>{profile.phone}</span>
                                    </div>
                                )}
                            </div>

                            <form className="cpp-form" onSubmit={handleSubmit}>
                                {/* ── Thông tin cơ bản ── */}
                                <div className="cpp-section-title">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                    </svg>
                                    <span>Thông tin cơ bản</span>
                                </div>

                                <div className="cpp-form-row cpp-form-row--2">
                                    <div className="cpp-field">
                                        <label className="cpp-label" htmlFor="basic-fullName">
                                            Họ và tên <span className="cpp-required">*</span>
                                        </label>
                                        <input
                                            id="basic-fullName"
                                            type="text"
                                            name="fullName"
                                            value={form.fullName}
                                            onChange={handleChange}
                                            className="cpp-input"
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

                                <div className="cpp-form-row cpp-form-row--2">
                                    <div className="cpp-field">
                                        <label className="cpp-label">Email</label>
                                        <input type="text" value={profile?.email || ''} className="cpp-input cpp-input--readonly" readOnly />
                                    </div>
                                    <div className="cpp-field">
                                        <label className="cpp-label">Số điện thoại</label>
                                        <input type="text" value={profile?.phone || ''} className="cpp-input cpp-input--readonly" readOnly />
                                    </div>
                                </div>

                                {/* ── Địa chỉ ── */}
                                <div className="cpp-section-title">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                                    </svg>
                                    <span>Địa chỉ liên lạc</span>
                                </div>

                                <div className="cpp-form-row cpp-form-row--3">
                                    <div className="cpp-field">
                                        <label className="cpp-label" htmlFor="basic-province">Tỉnh / Thành phố</label>
                                        <select
                                            id="basic-province"
                                            value={form.provinceCode}
                                            onChange={handleProvinceChange}
                                            disabled={loadingProv}
                                            className={`cpp-select ${loadingProv ? 'cpp-select--disabled' : ''}`}
                                        >
                                            <option value="">{loadingProv ? 'Đang tải...' : '-- Chọn Tỉnh/TP --'}</option>
                                            {provinces.map((p) => (
                                                <option key={p.value} value={p.value}>{p.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="cpp-field">
                                        <label className="cpp-label" htmlFor="basic-district">Quận / Huyện</label>
                                        <select
                                            id="basic-district"
                                            value={form.districtCode}
                                            onChange={handleDistrictChange}
                                            disabled={!form.provinceCode || loadingDist}
                                            className={`cpp-select ${(!form.provinceCode || loadingDist) ? 'cpp-select--disabled' : ''}`}
                                        >
                                            <option value="">
                                                {loadingDist ? 'Đang tải...' : !form.provinceCode ? '-- Chọn Tỉnh/TP trước --' : '-- Chọn Quận/Huyện --'}
                                            </option>
                                            {districts.map((d) => (
                                                <option key={d.value} value={d.value}>{d.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="cpp-field">
                                        <label className="cpp-label" htmlFor="basic-ward">Phường / Xã</label>
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
                                            className={`cpp-select ${(!form.districtCode || loadingWard) ? 'cpp-select--disabled' : ''}`}
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

                                <div className="cpp-form-row cpp-form-row--2">
                                    <div className="cpp-field">
                                        <label className="cpp-label" htmlFor="basic-addressLabel">Nhãn địa chỉ</label>
                                        <select
                                            id="basic-addressLabel"
                                            name="addressLabel"
                                            value={form.addressLabel}
                                            onChange={handleChange}
                                            className="cpp-select"
                                        >
                                            {addressLabels.length === 0
                                                ? <option value="HOME">HOME</option>
                                                : addressLabels.map((lb) => (
                                                    <option key={lb} value={lb}>{lb}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                    <div className="cpp-field">
                                        <label className="cpp-label" htmlFor="basic-addressDetail">Địa chỉ chi tiết</label>
                                        <div className="cpp-autocomplete-wrapper" ref={addressWrapperRef}>
                                            <input
                                                id="basic-addressDetail"
                                                type="text"
                                                name="addressDetail"
                                                value={form.addressDetail}
                                                onChange={handleChange}
                                                onFocus={() => addressSuggestions.length > 0 && setShowAddressSuggestions(true)}
                                                className="cpp-input"
                                                placeholder="Số nhà, tên đường..."
                                                autoComplete="off"
                                            />
                                            {showAddressSuggestions && addressSuggestions.length > 0 && (
                                                <ul className="cpp-autocomplete-list">
                                                    {addressSuggestions.map((s) => (
                                                        <li
                                                            key={s.place_id}
                                                            className="cpp-autocomplete-item"
                                                            onMouseDown={() => handleSelectAddressSuggestion(s)}
                                                        >
                                                            <svg className="cpp-autocomplete-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                                <div className="cpp-field" style={{ marginTop: '1rem' }}>
                                    <label className="cpp-label" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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

                                {(profile?.wardName || profile?.districtName || profile?.provinceName) && (
                                    <div className="cpp-current-address">
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
                                <div className="cpp-form-actions">
                                    <button id="basic-save-btn" type="submit" className="cpp-btn cpp-btn--primary" disabled={saving || uploadingAvatar}>
                                        {saving ? (
                                            <><span className="cpp-spinner" />Đang lưu...</>
                                        ) : (
                                            <>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                                    <polyline points="17 21 17 13 7 13 7 21" />
                                                    <polyline points="7 3 7 8 15 8" />
                                                </svg>
                                                Cập nhật
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </CustomerLayout>
    );
};

export default CustomerProfilePage;
