import React, { useState, useRef, useEffect } from 'react';
import './KYCModal.css';
import HelperRegistrationService from '../services/HelperRegistrationService';
import CloudinaryService from '../services/CloudinaryService';
import logoHomeiConnect from '../assets/LogoHomeiConnect.png';

const KYCModal = ({ isOpen, onClose, onSuccess }) => {
    const [currentStage, setCurrentStage] = useState(1);
    const [provinces, setProvinces] = useState([]);
    const [workingDistricts, setWorkingDistricts] = useState([]);
    const [services, setServices] = useState([]);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);

    const [formData, setFormData] = useState({
        // Stage 1
        dateOfBirth: '',
        bio: '',
        experienceYears: '',
        hometownProvinceId: '',
        currentCityId: '',
        currentAddress: '',
        workingDistrictIds: [],
        serviceIds: [],
        // Stage 2
        identityNumber: '',
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

    // Fetch danh sách tỉnh/thành và dịch vụ khi modal mở
    useEffect(() => {
        if (!isOpen) return;

        const fetchInitialData = async () => {
            setLoadingProvinces(true);
            setLoadingServices(true);
            try {
                const [provincesData, servicesData] = await Promise.all([
                    HelperRegistrationService.getProvinces(),
                    HelperRegistrationService.getServices()
                ]);
                setProvinces(Array.isArray(provincesData) ? provincesData : []);
                setServices(Array.isArray(servicesData) ? servicesData : []);
            } catch (err) {
                console.error('Lỗi khi tải dữ liệu:', err);
                setProvinces([]);
                setServices([]);
            } finally {
                setLoadingProvinces(false);
                setLoadingServices(false);
            }
        };

        fetchInitialData();
    }, [isOpen]);

    // Fetch danh sách quận/huyện khi chọn thành phố hiện tại
    useEffect(() => {
        if (!formData.currentCityId) {
            setWorkingDistricts([]);
            return;
        }

        const fetchDistricts = async () => {
            setLoadingDistricts(true);
            try {
                const data = await HelperRegistrationService.getDistricts(formData.currentCityId);
                setWorkingDistricts(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Lỗi khi tải danh sách quận/huyện:', err);
                setWorkingDistricts([]);
            } finally {
                setLoadingDistricts(false);
            }
        };

        fetchDistricts();
    }, [formData.currentCityId]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (type === 'checkbox') {
            const numValue = parseInt(value);
            setFormData(prev => ({
                ...prev,
                [name]: checked
                    ? [...prev[name], numValue]
                    : prev[name].filter(id => id !== numValue)
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

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

    const validateStage1 = () => {
        if (!formData.dateOfBirth) {
            setError('Vui lòng nhập ngày sinh');
            return false;
        }
        if (!formData.bio.trim()) {
            setError('Vui lòng nhập giới thiệu bản thân');
            return false;
        }
        if (!formData.experienceYears || formData.experienceYears < 0) {
            setError('Vui lòng nhập số năm kinh nghiệm hợp lệ');
            return false;
        }
        if (!formData.hometownProvinceId) {
            setError('Vui lòng chọn tỉnh/thành quê quán');
            return false;
        }
        if (!formData.currentCityId) {
            setError('Vui lòng chọn thành phố hiện tại');
            return false;
        }
        if (!formData.currentAddress.trim()) {
            setError('Vui lòng nhập địa chỉ hiện tại');
            return false;
        }
        if (formData.workingDistrictIds.length === 0) {
            setError('Vui lòng chọn ít nhất một khu vực làm việc');
            return false;
        }
        if (formData.serviceIds.length === 0) {
            setError('Vui lòng chọn ít nhất một dịch vụ');
            return false;
        }
        return true;
    };

    const validateStage2 = () => {
        if (!formData.identityNumber.trim()) {
            setError('Vui lòng nhập số CCCD');
            return false;
        }
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
        return true;
    };

    const handleContinue = async (e) => {
        e.preventDefault();
        if (!validateStage1()) return;

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const stage1Data = {
                dateOfBirth: formData.dateOfBirth,
                bio: formData.bio.trim(),
                experienceYears: parseInt(formData.experienceYears),
                hometownProvinceId: parseInt(formData.hometownProvinceId),
                currentCityId: parseInt(formData.currentCityId),
                currentAddress: formData.currentAddress.trim(),
                workingDistrictIds: formData.workingDistrictIds,
                serviceIds: formData.serviceIds,
            };

            await HelperRegistrationService.registerStage1(stage1Data);
            setCurrentStage(2);
            setSuccess('Đã lưu thông tin giai đoạn 1. Vui lòng tiếp tục giai đoạn 2.');
        } catch (err) {
            console.error('Stage 1 Error:', err);
            setError(err.message || 'Có lỗi xảy ra khi lưu thông tin giai đoạn 1');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateStage2()) return;

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

            const stage2Data = {
                identityNumber: formData.identityNumber.trim(),
                cccdFrontUrl: cccdFrontUrl,
                cccdBackUrl: cccdBackUrl,
                selfieUrl: avatarUrl,
            };

            await HelperRegistrationService.registerStage2(stage2Data);

            // Submit registration
            const response = await HelperRegistrationService.submitRegistration();

            if (response.success) {
                setSuccess(response.message || 'Hồ sơ đã được gửi thành công!');

                // Cập nhật trạng thái trong localStorage
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
            console.error('Stage 2 Error:', err);
            // Xử lý lỗi validation từ backend (dạng object field-level)
            if (err && typeof err === 'object' && !err.message) {
                const messages = Object.values(err).join(', ');
                setError(messages || 'Có lỗi xảy ra khi gửi hồ sơ');
            } else if (err.message?.toLowerCase().includes('upload')) {
                setError('Lỗi tải ảnh lên. Vui lòng kiểm tra kết nối mạng và thử lại.');
            } else {
                setError(err.message || 'Có lỗi xảy ra khi gửi hồ sơ');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setCurrentStage(1);
        setError('');
        setSuccess('');
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
                        <img src={logoHomeiConnect} alt="HomieConnect Logo" style={{ height: '48px', objectFit: 'contain' }} />
                    </div>
                    <h2 className="kyc-title">Đăng ký Helper - Giai đoạn {currentStage}/2</h2>
                    <p className="kyc-subtitle">
                        {currentStage === 1
                            ? 'Thông tin cá nhân & Dịch vụ'
                            : 'Xác thực danh tính (CCCD)'}
                    </p>
                </div>

                {/* Error / Success Messages */}
                {error && <div className="kyc-error">{error}</div>}

                {/* {success && <div className="kyc-success">{success}</div>} */}

                {/* Stage 1: Thông tin cá nhân & Dịch vụ */}
                {currentStage === 1 && (
                    <form className="kyc-form" onSubmit={handleContinue}>
                        {/* Ngày sinh */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                Ngày sinh <span className="kyc-required">*</span>
                            </label>
                            <input
                                type="date"
                                name="dateOfBirth"
                                className="kyc-input"
                                value={formData.dateOfBirth}
                                onChange={handleInputChange}
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>

                        {/* Giới thiệu bản thân */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                </svg>
                                Giới thiệu bản thân <span className="kyc-required">*</span>
                            </label>
                            <textarea
                                name="bio"
                                className="kyc-input"
                                rows="4"
                                placeholder="Giới thiệu về bản thân, kinh nghiệm làm việc..."
                                value={formData.bio}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Số năm kinh nghiệm */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                Số năm kinh nghiệm <span className="kyc-required">*</span>
                            </label>
                            <input
                                type="number"
                                name="experienceYears"
                                className="kyc-input"
                                placeholder="Ví dụ: 3"
                                min="0"
                                value={formData.experienceYears}
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
                                name="hometownProvinceId"
                                className="kyc-select"
                                value={formData.hometownProvinceId}
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

                        {/* Thành phố hiện tại */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                Thành phố hiện tại <span className="kyc-required">*</span>
                            </label>
                            <select
                                name="currentCityId"
                                className="kyc-select"
                                value={formData.currentCityId}
                                onChange={handleInputChange}
                                disabled={loadingProvinces}
                            >
                                <option value="">
                                    {loadingProvinces ? 'Đang tải...' : '-- Chọn thành phố --'}
                                </option>
                                {provinces.map((province) => (
                                    <option key={province.id} value={province.id}>
                                        {province.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Địa chỉ hiện tại */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                                Địa chỉ hiện tại <span className="kyc-required">*</span>
                            </label>
                            <input
                                type="text"
                                name="currentAddress"
                                className="kyc-input"
                                placeholder="Ví dụ: Số 123, Đường ABC, Phường XYZ"
                                value={formData.currentAddress}
                                onChange={handleInputChange}
                            />
                        </div>

                        {/* Khu vực làm việc */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <polyline points="2 17 12 22 22 17" />
                                    <polyline points="2 12 12 17 22 12" />
                                </svg>
                                Khu vực làm việc <span className="kyc-required">*</span>
                            </label>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                {formData.currentCityId
                                    ? 'Chọn các quận/huyện bạn muốn làm việc:'
                                    : 'Vui lòng chọn thành phố hiện tại trước'}
                            </div>
                            {loadingDistricts ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
                            ) : workingDistricts.length > 0 ? (
                                <div style={{
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '0.5rem'
                                }}>
                                    {workingDistricts.map((district) => (
                                        <label
                                            key={district.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0.5rem',
                                                cursor: 'pointer',
                                                borderRadius: '4px'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <input
                                                type="checkbox"
                                                name="workingDistrictIds"
                                                value={district.id}
                                                checked={formData.workingDistrictIds.includes(district.id)}
                                                onChange={handleInputChange}
                                                style={{ marginRight: '0.5rem' }}
                                            />
                                            {district.name}
                                        </label>
                                    ))}
                                </div>
                            ) : formData.currentCityId ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                                    Không có quận/huyện nào
                                </div>
                            ) : null}
                        </div>

                        {/* Dịch vụ */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                                </svg>
                                Dịch vụ đăng ký <span className="kyc-required">*</span>
                            </label>
                            {loadingServices ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
                            ) : services.length > 0 ? (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                                    gap: '0.75rem'
                                }}>
                                    {services.map((service) => (
                                        <label
                                            key={service.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '0.75rem',
                                                border: formData.serviceIds.includes(service.id)
                                                    ? '2px solid #3b82f6'
                                                    : '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                backgroundColor: formData.serviceIds.includes(service.id)
                                                    ? '#eff6ff'
                                                    : 'white',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                name="serviceIds"
                                                value={service.id}
                                                checked={formData.serviceIds.includes(service.id)}
                                                onChange={handleInputChange}
                                                style={{ marginRight: '0.5rem' }}
                                            />
                                            <span style={{ fontSize: '0.9rem' }}>{service.name}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                                    Không có dịch vụ nào
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button type="submit" className="kyc-submit-btn" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <span className="kyc-spinner" />
                                    Đang xử lý...
                                </>
                            ) : (
                                'Tiếp tục'
                            )}
                        </button>
                    </form>
                )}

                {/* Stage 2: Xác thực danh tính */}
                {currentStage === 2 && (
                    <form className="kyc-form" onSubmit={handleSubmit}>
                        {/* Số CCCD */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                    <line x1="1" y1="10" x2="23" y2="10" />
                                </svg>
                                Số CCCD/CMND <span className="kyc-required">*</span>
                            </label>
                            <input
                                type="text"
                                name="identityNumber"
                                className="kyc-input"
                                placeholder="Nhập số CCCD/CMND"
                                value={formData.identityNumber}
                                onChange={handleInputChange}
                            />
                        </div>

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

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={handleBack}
                                style={{
                                    width: '48%',
                                    padding: '0.875rem 1.5rem',
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                disabled={isLoading}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                            >
                                Quay lại
                            </button>
                            <button type="submit" className="kyc-submit-btn" style={{ width: '48%', margin: 0 }} disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <span className="kyc-spinner" />
                                        Đang gửi hồ sơ...
                                    </>
                                ) : (
                                    'Gửi hồ sơ'
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default KYCModal;
