import React, { useState, useEffect, useCallback } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import ProfileService from '../../services/ProfileService';
import HelperRegistrationService from '../../services/HelperRegistrationService';
import NotificationModal from '../../components/NotificationModal';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './CustomerProfilePage.css';

// Fix Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationMarker = ({ position, setPosition }) => {
    const map = useMapEvents({
        click(e) {
            setPosition(e.latlng);
            map.flyTo(e.latlng, map.getZoom());
        },
    });

    useEffect(() => {
        if (position?.lat && position?.lng) {
            map.flyTo(position, map.getZoom());
        }
    }, [position, map]);

    return position?.lat && position?.lng ? (
        <Marker position={position}></Marker>
    ) : null;
};

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
    const [toast, setToast] = useState(null);

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
        if (!form.provinceCode) return;

        const timer = setTimeout(async () => {
            const provinceName = provinces.find(p => p.value == form.provinceCode)?.label;
            const districtName = districts.find(d => d.value == form.districtCode)?.label;
            const wardName = wards.find(w => w.value == form.wardCode)?.label;
            const street = form.addressDetail?.trim();

            // Helper: clean prefix từ tên hành chính
            const cleanName = (name) => name?.replace(/^(Tỉnh|Thành phố|Quận|Huyện|Phường|Xã)\s+/i, '') || '';

            // Helper: geocode một query
            const geocode = async (query) => {
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`
                    );
                    const data = await res.json();
                    if (data && data.length > 0) {
                        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                    }
                } catch (err) {
                    console.error("Geocoding failed:", err);
                }
                return null;
            };

            // Chỉ dùng addressDetail khi đã chọn đủ Tỉnh + Quận + Phường
            const hasFullAddress = provinceName && districtName && wardName;

            // Tạo các query từ chi tiết nhất đến ít chi tiết nhất
            const queries = [];
            if (hasFullAddress && street) {
                // Query 1: Địa chỉ đầy đủ với số nhà
                queries.push([street, cleanName(wardName), cleanName(districtName), cleanName(provinceName)].join(", "));
            }
            if (hasFullAddress) {
                // Query 2: Chỉ Phường + Quận + Tỉnh (fallback khi không tìm thấy số nhà)
                queries.push([cleanName(wardName), cleanName(districtName), cleanName(provinceName)].join(", "));
            }
            if (districtName) {
                // Query 3: Chỉ Quận + Tỉnh
                queries.push([cleanName(districtName), cleanName(provinceName)].join(", "));
            }
            if (provinceName) {
                // Query 4: Chỉ Tỉnh
                queries.push(cleanName(provinceName));
            }

            // Thử từng query cho đến khi tìm thấy kết quả
            for (const query of queries) {
                const result = await geocode(query);
                if (result) {
                    setForm(prev => ({
                        ...prev,
                        latitude: result.lat,
                        longitude: result.lng
                    }));
                    break;
                }
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [form.provinceCode, form.districtCode, form.wardCode, form.addressDetail, provinces, districts, wards]);

    const handleMapLocationChange = (latlng) => {
        setForm(prev => ({
            ...prev,
            latitude: latlng.lat,
            longitude: latlng.lng
        }));
    };

    const handleChange = (e) =>
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

    // Resize + compress ảnh bằng Canvas trước khi lưu base64
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

            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            setForm((f) => ({ ...f, avatarUrl: compressed }));
            URL.revokeObjectURL(objectUrl);
        };
        img.onerror = () => {
            setToast({ message: 'Không thể đọc file ảnh', type: 'error' });
            URL.revokeObjectURL(objectUrl);
        };
        img.src = objectUrl;

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
                districtName: form.districtName || null,
                provinceName: form.provinceName || null,
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
                                    onClick={() => document.getElementById('avatar-file-input').click()}
                                    title="Nhấn để đổi ảnh đại diện"
                                >
                                    {form.avatarUrl
                                        ? <img src={form.avatarUrl} alt="Avatar" className="cpp-avatar-img" />
                                        : <span className="cpp-avatar-initials">{getInitials(form.fullName)}</span>
                                    }
                                    <div className="cpp-avatar-overlay">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                            <circle cx="12" cy="13" r="4" />
                                        </svg>
                                        <span>Đổi ảnh</span>
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
                                        <input
                                            id="basic-addressDetail"
                                            type="text"
                                            name="addressDetail"
                                            value={form.addressDetail}
                                            onChange={handleChange}
                                            className="cpp-input"
                                            placeholder="Số nhà, tên đường..."
                                        />
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
                                        <MapContainer
                                            center={[form.latitude, form.longitude]}
                                            zoom={14}
                                            style={{ height: '100%', width: '100%' }}
                                            scrollWheelZoom={false}
                                        >
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                            <LocationMarker
                                                position={{ lat: form.latitude, lng: form.longitude }}
                                                setPosition={handleMapLocationChange}
                                            />
                                        </MapContainer>
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
                                    <button id="basic-save-btn" type="submit" className="cpp-btn cpp-btn--primary" disabled={saving}>
                                        {saving ? (
                                            <><span className="cpp-spinner" />Đang lưu...</>
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
                    )}
                </div>
            </div>
        </CustomerLayout>
    );
};

export default CustomerProfilePage;
