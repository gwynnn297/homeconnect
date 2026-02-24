import React, { useState, useRef, useEffect } from 'react';
import './KYCModal.css';
import UserService from '../services/UserService';
import CloudinaryService from '../services/CloudinaryService';

const KYCModal = ({ isOpen, onClose, onSuccess }) => {
    const [provinces, setProvinces] = useState([]);
    const [loadingProvinces, setLoadingProvinces] = useState(false);

    const [formData, setFormData] = useState({
        address: '',
        hometown: '',
    });

    // Preview URLs cho ảnh
    const [cccdFrontPreview, setCccdFrontPreview] = useState(null);
    const [cccdBackPreview, setCccdBackPreview] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);

    // File references
    const [cccdFrontFile, setCccdFrontFile] = useState(null);
    const [cccdBackFile, setCccdBackFile] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Refs cho input file
    const cccdFrontRef = useRef(null);
    const cccdBackRef = useRef(null);
    const avatarRef = useRef(null);

    // Fetch danh sách tỉnh/thành từ backend khi modal mở
    useEffect(() => {
        if (!isOpen) return;

        const fetchProvinces = async () => {
            setLoadingProvinces(true);
            try {
                const data = await UserService.getProvinces();
                setProvinces(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Lỗi khi tải danh sách tỉnh/thành:', err);
                setProvinces([]);
            } finally {
                setLoadingProvinces(false);
            }
        };

        fetchProvinces();
    }, [isOpen]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const handleFileSelect = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Vui lòng chọn file ảnh (JPG, PNG, ...)');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Kích thước ảnh tối đa là 5MB');
            return;
        }

        const previewUrl = URL.createObjectURL(file);

        switch (type) {
            case 'cccdFront':
                setCccdFrontFile(file);
                setCccdFrontPreview(previewUrl);
                break;
            case 'cccdBack':
                setCccdBackFile(file);
                setCccdBackPreview(previewUrl);
                break;
            case 'avatar':
                setAvatarFile(file);
                setAvatarPreview(previewUrl);
                break;
        }

        if (error) setError('');
    };

    const removeImage = (type) => {
        switch (type) {
            case 'cccdFront':
                setCccdFrontFile(null);
                setCccdFrontPreview(null);
                if (cccdFrontRef.current) cccdFrontRef.current.value = '';
                break;
            case 'cccdBack':
                setCccdBackFile(null);
                setCccdBackPreview(null);
                if (cccdBackRef.current) cccdBackRef.current.value = '';
                break;
            case 'avatar':
                setAvatarFile(null);
                setAvatarPreview(null);
                if (avatarRef.current) avatarRef.current.value = '';
                break;
        }
    };

    const validateForm = () => {
        if (!cccdFrontFile) {
            setError('Vui lòng tải lên ảnh mặt trước CCCD');
            return false;
        }
        if (!cccdBackFile) {
            setError('Vui lòng tải lên ảnh mặt sau CCCD');
            return false;
        }
        if (!avatarFile) {
            setError('Vui lòng tải lên ảnh chân dung');
            return false;
        }
        if (!formData.address.trim()) {
            setError('Vui lòng nhập địa chỉ liên hệ');
            return false;
        }
        if (!formData.hometown) {
            setError('Vui lòng chọn tỉnh/thành quê quán');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            // Upload 3 ảnh lên Cloudinary song song
            const [cccdFrontUrl, cccdBackUrl, avatarUrl] = await CloudinaryService.uploadMultiple([
                { file: cccdFrontFile, folder: 'kyc/cccd' },
                { file: cccdBackFile, folder: 'kyc/cccd' },
                { file: avatarFile, folder: 'kyc/avatar' },
            ]);

            const kycData = {
                cccdFront: cccdFrontUrl,
                cccdBack: cccdBackUrl,
                avatar: avatarUrl,
                address: formData.address.trim(),
                hometown: parseInt(formData.hometown),
            };

            const response = await UserService.updateKyc(kycData);

            if (response.success) {
                setSuccess(response.message || 'Hồ sơ KYC đã được gửi thành công!');
                // Cập nhật kycStatus trong localStorage
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.kycStatus = 'WAITING_APPROVAL';
                localStorage.setItem('user', JSON.stringify(user));

                setTimeout(() => {
                    if (onSuccess) onSuccess();
                }, 1500);
            } else {
                setError(response.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
            }
        } catch (err) {
            console.error('KYC Error:', err);
            if (err.message.includes('Upload') || err.message.includes('upload')) {
                setError('Lỗi tải ảnh lên. Vui lòng kiểm tra kết nối mạng và thử lại.');
            } else {
                setError(err.message || 'Có lỗi xảy ra khi gửi hồ sơ KYC');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="kyc-modal-overlay">
            <div className="kyc-modal-content">
                {/* Close Button */}
                <button className="kyc-close-btn" onClick={onClose} disabled={isLoading}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                {/* Header */}
                <div className="kyc-header">
                    <div className="kyc-icon-container">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <path d="M20 8v6" />
                            <path d="M23 11h-6" />
                        </svg>
                    </div>
                    <h2 className="kyc-title">Xác minh danh tính</h2>
                    <p className="kyc-subtitle">
                        Vui lòng cung cấp thông tin để hoàn tất đăng ký Helper
                    </p>
                </div>

                {/* Error / Success Messages */}
                {error && <div className="kyc-error">{error}</div>}
                {success && <div className="kyc-success">{success}</div>}

                {/* KYC Form */}
                <form className="kyc-form" onSubmit={handleSubmit}>

                    {/* CCCD Front & Back */}
                    <div className="kyc-form-group">
                        <label>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                            Ảnh CCCD/CMND <span className="kyc-required">*</span>
                        </label>
                        <div className="kyc-image-row">
                            {/* Front */}
                            <div>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem' }}>Mặt trước</p>
                                <div
                                    className={`kyc-upload-area ${cccdFrontPreview ? 'has-file' : ''}`}
                                    onClick={() => cccdFrontRef.current?.click()}
                                >
                                    <input
                                        ref={cccdFrontRef}
                                        type="file"
                                        accept="image/*"
                                        className="kyc-upload-input"
                                        onChange={(e) => handleFileSelect(e, 'cccdFront')}
                                    />
                                    {cccdFrontPreview ? (
                                        <div className="kyc-image-preview-wrapper">
                                            <img src={cccdFrontPreview} alt="CCCD Mặt trước" className="kyc-image-preview" />
                                            <button
                                                type="button"
                                                className="kyc-remove-image"
                                                onClick={(e) => { e.stopPropagation(); removeImage('cccdFront'); }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="kyc-upload-placeholder">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="17 8 12 3 7 8" />
                                                <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                            <span>Tải ảnh lên</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Back */}
                            <div>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem' }}>Mặt sau</p>
                                <div
                                    className={`kyc-upload-area ${cccdBackPreview ? 'has-file' : ''}`}
                                    onClick={() => cccdBackRef.current?.click()}
                                >
                                    <input
                                        ref={cccdBackRef}
                                        type="file"
                                        accept="image/*"
                                        className="kyc-upload-input"
                                        onChange={(e) => handleFileSelect(e, 'cccdBack')}
                                    />
                                    {cccdBackPreview ? (
                                        <div className="kyc-image-preview-wrapper">
                                            <img src={cccdBackPreview} alt="CCCD Mặt sau" className="kyc-image-preview" />
                                            <button
                                                type="button"
                                                className="kyc-remove-image"
                                                onClick={(e) => { e.stopPropagation(); removeImage('cccdBack'); }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="kyc-upload-placeholder">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="17 8 12 3 7 8" />
                                                <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                            <span>Tải ảnh lên</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Avatar / Selfie */}
                    <div className="kyc-form-group">
                        <label>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            Ảnh chân dung (Selfie) <span className="kyc-required">*</span>
                        </label>
                        <div
                            className={`kyc-upload-area ${avatarPreview ? 'has-file' : ''}`}
                            onClick={() => avatarRef.current?.click()}
                        >
                            <input
                                ref={avatarRef}
                                type="file"
                                accept="image/*"
                                className="kyc-upload-input"
                                onChange={(e) => handleFileSelect(e, 'avatar')}
                            />
                            {avatarPreview ? (
                                <div className="kyc-image-preview-wrapper">
                                    <img src={avatarPreview} alt="Ảnh chân dung" className="kyc-image-preview" />
                                    <button
                                        type="button"
                                        className="kyc-remove-image"
                                        onClick={(e) => { e.stopPropagation(); removeImage('avatar'); }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <div className="kyc-upload-placeholder">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <span>Tải ảnh chân dung lên</span>
                                    <span className="kyc-upload-hint">Ảnh rõ mặt, không đội mũ/kính</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Địa chỉ liên hệ */}
                    <div className="kyc-form-group">
                        <label>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            Địa chỉ liên hệ <span className="kyc-required">*</span>
                        </label>
                        <input
                            type="text"
                            name="address"
                            className="kyc-input"
                            placeholder="Ví dụ: Số 123, Đường ABC, Phường XYZ, Quận 1"
                            value={formData.address}
                            onChange={handleInputChange}
                        />
                    </div>

                    {/* Quê quán */}
                    <div className="kyc-form-group">
                        <label>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
                            Quê quán (Tỉnh/Thành) <span className="kyc-required">*</span>
                        </label>
                        <select
                            name="hometown"
                            className="kyc-select"
                            value={formData.hometown}
                            onChange={handleInputChange}
                            disabled={loadingProvinces}
                        >
                            <option value="">
                                {loadingProvinces ? 'Đang tải...' : '-- Chọn tỉnh/thành phố --'}
                            </option>
                            {provinces.map((province) => (
                                <option key={province.id} value={province.id}>
                                    {province.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Submit */}
                    <button type="submit" className="kyc-submit-btn" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <span className="kyc-spinner" />
                                Đang gửi hồ sơ...
                            </>
                        ) : (
                            'Gửi hồ sơ xác minh'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default KYCModal;
