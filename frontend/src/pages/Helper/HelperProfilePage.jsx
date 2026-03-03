import React, { useState, useEffect, useCallback } from 'react';
import HelperLayout from '../../layouts/HelperLayout';
import ProfileService from '../../services/ProfileService';
import HelperRegistrationService from '../../services/HelperRegistrationService';
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

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const t = setTimeout(onClose, 3500);
        return () => clearTimeout(t);
    }, [onClose]);

    return (
        <div className={`hpp-toast hpp-toast--${type}`}>
            {type === 'success' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            )}
            <span>{message}</span>
        </div>
    );
};

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
        wardId: '',
        districtId: '',
        provinceId: '',
        addressLabel: 'HOME',
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

    const toOptions = (arr) =>
        arr.map((item) => ({ value: String(item.id ?? item), label: item.name ?? item }));

    // ── Bootstrap: load provinces + address labels, then cascade districts & wards.
    // Backend UserProfileResponse only returns *names* (provinceName, districtName, wardName),
    // not IDs → we resolve IDs by matching names against the loaded dropdown lists.
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
        }));

        // 2. Load address-label options
        ProfileService.getAddressLabels()
            .then((res) => setAddressLabels(res.data || []))
            .catch(() => { });

        // 3. Load provinces → resolve province ID from saved provinceName → cascade
        setLoadingProv(true);
        HelperRegistrationService.getProvinces()
            .then(async (res) => {
                // HelperRegistrationController returns plain List (not ApiResponse wrapper)
                // so apiClient gives us the array directly
                const rawProv = Array.isArray(res) ? res : (res?.data || []);
                setProvinces(toOptions(rawProv));

                // --- resolve province by name ---
                if (!profile.provinceName) return;
                const matchedProv = rawProv.find((p) => p.name === profile.provinceName);
                if (!matchedProv) return;

                const resolvedProvId = String(matchedProv.id);
                setForm((f) => ({ ...f, provinceId: resolvedProvId }));

                // --- load & resolve district ---
                setLoadingDist(true);
                try {
                    const dRes = await HelperRegistrationService.getDistricts(resolvedProvId);
                    const rawDist = Array.isArray(dRes) ? dRes : (dRes?.data || []);
                    setDistricts(toOptions(rawDist));

                    if (!profile.districtName) return;
                    const matchedDist = rawDist.find((d) => d.name === profile.districtName);
                    if (!matchedDist) return;

                    const resolvedDistId = String(matchedDist.id);
                    setForm((f) => ({ ...f, districtId: resolvedDistId }));

                    // --- load & resolve ward ---
                    setLoadingWard(true);
                    try {
                        const wRes = await HelperRegistrationService.getWards(resolvedDistId);
                        const rawWard = Array.isArray(wRes) ? wRes : (wRes?.data || []);
                        setWards(toOptions(rawWard));

                        if (!profile.wardName) return;
                        const matchedWard = rawWard.find((w) => w.name === profile.wardName);
                        if (matchedWard) {
                            setForm((f) => ({ ...f, wardId: String(matchedWard.id) }));
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
        const provId = e.target.value;
        setForm((f) => ({ ...f, provinceId: provId, districtId: '', wardId: '' }));
        setDistricts([]);
        setWards([]);
        if (!provId) return;
        setLoadingDist(true);
        try {
            const res = await HelperRegistrationService.getDistricts(provId);
            setDistricts(toOptions(Array.isArray(res) ? res : (res?.data || [])));
        } catch { /* ignore */ }
        finally { setLoadingDist(false); }
    };

    // District → Wards (user-initiated change)
    const handleDistrictChange = async (e) => {
        const distId = e.target.value;
        setForm((f) => ({ ...f, districtId: distId, wardId: '' }));
        setWards([]);
        if (!distId) return;
        setLoadingWard(true);
        try {
            const res = await HelperRegistrationService.getWards(distId);
            setWards(toOptions(Array.isArray(res) ? res : (res?.data || [])));
        } catch { /* ignore */ }
        finally { setLoadingWard(false); }
    };

    const handleChange = (e) =>
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

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
            const payload = {
                fullName: form.fullName,
                avatarUrl: form.avatarUrl || null,
                gender: form.gender || null,
                addressDetail: form.addressDetail || null,
                wardId: form.wardId ? parseInt(form.wardId, 10) : null,
                districtId: form.districtId ? parseInt(form.districtId, 10) : null,
                provinceId: form.provinceId ? parseInt(form.provinceId, 10) : null,
                addressLabel: form.addressLabel || 'HOME',
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
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
                        <input
                            id="basic-addressDetail"
                            type="text"
                            name="addressDetail"
                            value={form.addressDetail}
                            onChange={handleChange}
                            className="hpp-input"
                            placeholder="Số nhà, tên đường..."
                        />
                    </div>
                </div>

                {/* Tỉnh/Thành phố */}
                <div className="hpp-form-row hpp-form-row--3">
                    <div className="hpp-field">
                        <label className="hpp-label" htmlFor="basic-province">Tỉnh / Thành phố</label>
                        <select
                            id="basic-province"
                            value={form.provinceId}
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
                            value={form.districtId}
                            onChange={handleDistrictChange}
                            disabled={!form.provinceId || loadingDist}
                            className={`hpp-select ${(!form.provinceId || loadingDist) ? 'hpp-select--disabled' : ''}`}
                        >
                            <option value="">
                                {loadingDist ? 'Đang tải...' : !form.provinceId ? '-- Chọn Tỉnh/TP trước --' : '-- Chọn Quận/Huyện --'}
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
                            value={form.wardId}
                            onChange={(e) => setForm((f) => ({ ...f, wardId: e.target.value }))}
                            disabled={!form.districtId || loadingWard}
                            className={`hpp-select ${(!form.districtId || loadingWard) ? 'hpp-select--disabled' : ''}`}
                        >
                            <option value="">
                                {loadingWard ? 'Đang tải...' : !form.districtId ? '-- Chọn Quận/Huyện trước --' : '-- Chọn Phường/Xã --'}
                            </option>
                            {wards.map((w) => (
                                <option key={w.value} value={w.value}>{w.label}</option>
                            ))}
                        </select>
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
        hometownProvinceId: '',  // → sent as hometownId
        workProvinceId: '',   // UI-only: filter for working districts
        workingDistrictIds: [],
        serviceIds: [],
    });

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    const toOptionsArr = (res) => {
        const arr = Array.isArray(res) ? res : (res?.data || []);
        return arr.map((item) => ({ value: String(item.id ?? item), label: item.name ?? item }));
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
                    hometownProvinceId: data.hometownId ? String(data.hometownId) : '',
                    workingDistrictIds: data.workingDistricts?.map((d) => d.id) || [],
                    serviceIds: data.services?.map((s) => s.id) || [],
                }));
            })
            .catch((err) => console.error('[ProfessionalTab] fetch failed:', err))
            .finally(() => setLoadingInit(false));
    }, []);

    useEffect(() => { fetchProfile(); }, [fetchProfile]);

    // Load provinces once
    useEffect(() => {
        setLoadingProv(true);
        HelperRegistrationService.getProvinces()
            .then((res) => setAllProvinces(toOptionsArr(res)))
            .catch(() => { })
            .finally(() => setLoadingProv(false));
    }, []);

    // Load services once
    useEffect(() => {
        setLoadingSvc(true);
        HelperRegistrationService.getServices()
            .then((res) => setAllServices(toOptionsArr(res)))
            .catch(() => { })
            .finally(() => setLoadingSvc(false));
    }, []);

    // When workingDistricts loaded from profile, detect which province they belong to
    // by loading all provinces' districts until we find a match → set workProvinceId
    useEffect(() => {
        if (!form.workingDistrictIds.length || !allProvinces.length) return;
        if (form.workProvinceId) return; // already set

        // Try to find province by loading districts per province until matching
        const firstSavedDistId = String(form.workingDistrictIds[0]);
        let cancelled = false;

        (async () => {
            for (const prov of allProvinces) {
                if (cancelled) break;
                try {
                    const res = await HelperRegistrationService.getDistricts(prov.value);
                    const dists = Array.isArray(res) ? res : (res?.data || []);
                    const found = dists.some((d) => String(d.id) === firstSavedDistId);
                    if (found && !cancelled) {
                        setForm((f) => ({ ...f, workProvinceId: prov.value }));
                        setAllWorkDistricts(
                            dists.map((d) => ({ value: String(d.id), label: d.name }))
                        );
                        break;
                    }
                } catch { /* ignore */ }
            }
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.workingDistrictIds, allProvinces]);

    // When user manually changes the work-province filter
    const handleWorkProvinceChange = async (e) => {
        const provId = e.target.value;
        setForm((f) => ({ ...f, workProvinceId: provId }));
        setAllWorkDistricts([]);
        if (!provId) return;
        setLoadingWorkDist(true);
        try {
            const res = await HelperRegistrationService.getDistricts(provId);
            setAllWorkDistricts(toOptionsArr(res));
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
            const payload = {
                bio: form.bio,
                experienceYears: parseInt(form.experienceYears, 10) || 0,
                dateOfBirth: form.dateOfBirth || null,
                hometownId: form.hometownProvinceId ? parseInt(form.hometownProvinceId, 10) : null,
                workingDistrictIds: form.workingDistrictIds.map((id) => parseInt(id, 10)),
                serviceIds: form.serviceIds.map((id) => parseInt(id, 10)),
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

    return (
        <div className="hpp-tab-content">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
                        name="hometownProvinceId"
                        value={form.hometownProvinceId}
                        onChange={handleChange}
                        disabled={loadingProv}
                        className={`hpp-select ${loadingProv ? 'hpp-select--disabled' : ''}`}
                    >
                        <option value="">{loadingProv ? 'Đang tải...' : '-- Chọn Tỉnh/TP quê quán --'}</option>
                        {allProvinces.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
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
                    {form.workingDistrictIds.length > 0 && (
                        <span className="hpp-selected-count">{form.workingDistrictIds.length} quận/huyện đã chọn</span>
                    )}
                </div>

                {/* Filter: chọn tỉnh để load danh sách quận */}
                <div className="hpp-field">
                    <label className="hpp-label" htmlFor="prof-workProv">Lọc theo Tỉnh / Thành phố</label>
                    <select
                        id="prof-workProv"
                        value={form.workProvinceId}
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
                    selectedIds={form.workingDistrictIds.map(String)}
                    onChange={(ids) => setForm((f) => ({ ...f, workingDistrictIds: ids }))}
                    loading={loadingWorkDist}
                    emptyText={form.workProvinceId ? 'Không có quận/huyện nào' : 'Chọn Tỉnh/TP ở trên để xem danh sách'}
                />

                {/* ── Dịch vụ ── */}
                <div className="hpp-section-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                    <span>Dịch vụ cung cấp</span>
                    <span className="hpp-selected-count">{form.serviceIds.length} dịch vụ đã chọn</span>
                </div>

                <MultiCheckboxField
                    id="prof-services"
                    label="Chọn các dịch vụ bạn cung cấp"
                    options={allServices}
                    selectedIds={form.serviceIds.map(String)}
                    onChange={(ids) => setForm((f) => ({ ...f, serviceIds: ids }))}
                    loading={loadingSvc}
                    emptyText="Không có dịch vụ nào"
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

    const fetchBasic = useCallback(() => {
        setLoadingBasic(true);
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
            .finally(() => setLoadingBasic(false));
    }, []);

    useEffect(() => { fetchBasic(); }, [fetchBasic]);

    return (
        <HelperLayout>
            <div className="hpp-page">
                {/* Page header */}
                <div className="hpp-page-header">
                    <div className="hpp-page-header-left">
                        <h1 className="hpp-page-title">Hồ sơ cá nhân</h1>
                        <p className="hpp-page-subtitle">Quản lý thông tin cá nhân và hồ sơ nghề nghiệp của bạn</p>
                    </div>
                    {!loadingBasic && basicProfile?.role && (
                        <span className="hpp-role-tag">{basicProfile.role}</span>
                    )}
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
                            : <BasicInfoTab profile={basicProfile} onSaved={fetchBasic} />
                    )}
                    {activeTab === 'professional' && <ProfessionalProfileTab />}
                </div>
            </div>
        </HelperLayout>
    );
};

export default HelperProfilePage;
