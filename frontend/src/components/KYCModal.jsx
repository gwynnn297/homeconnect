import React, { useState, useRef, useEffect } from 'react';
import './KYCModal.css';
import HelperRegistrationService from '../services/HelperRegistrationService';
import KycService from '../services/KycService';
import CloudinaryService from '../services/CloudinaryService';
import logoHomieConnect from '../assets/LogoHomieConnect.png';
import { reverseGeocodeStreet, autocompleteAddressGoong, getPlaceDetailGoong, geocodeAddressGoong } from '../utils/mapLocationUtils';
import MapGoongComponent from './MapGoongComponent';

const normalizeCategoryOptions = (rawData) => {
    if (!Array.isArray(rawData)) return [];
    return rawData
        .map((cat) => {
            const categoryId = Number(cat?.categoryId ?? cat?.id);
            const categoryName = String(cat?.categoryName ?? cat?.name ?? '').trim();
            if (!Number.isInteger(categoryId) || categoryId <= 0 || !categoryName) return null;
            return {
                categoryId,
                categoryName,
                basePrice: cat?.basePrice ?? null,
                unit: cat?.unit ?? '',
            };
        })
        .filter(Boolean);
};

const KYCModal = ({ isOpen, onClose, onSuccess }) => {
    const [currentStage, setCurrentStage] = useState(1);
    const [provinces, setProvinces] = useState([]);
    const [cityDistricts, setCityDistricts] = useState([]);
    const [cityWards, setCityWards] = useState([]);
    const [services, setServices] = useState([]);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loadingWards, setLoadingWards] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);
    const [hasManualAddressEdit, setHasManualAddressEdit] = useState(false);

    const [formData, setFormData] = useState({
        // Stage 1
        dateOfBirth: '',
        bio: '',
        experienceYears: '',
        hometownCode: '',
        provinceCode: '',
        districtCode: '',
        wardCode: '',
        currentAddress: '',
        workingDistrictCodes: [],
        categoryIds: [],
        latitude: 16.0544,  // Default Da Nang
        longitude: 108.2022,
    });

    // Preview URLs cho ảnh
    const [cccdFrontPreview, setCccdFrontPreview] = useState(null);
    const [cccdBackPreview, setCccdBackPreview] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [faceLeftPreview, setFaceLeftPreview] = useState(null);
    const [faceRightPreview, setFaceRightPreview] = useState(null);

    // File references
    const [cccdFrontFile, setCccdFrontFile] = useState(null);
    const [cccdBackFile, setCccdBackFile] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [faceLeftFile, setFaceLeftFile] = useState(null);
    const [faceRightFile, setFaceRightFile] = useState(null);

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Address autocomplete
    const [addressSuggestions, setAddressSuggestions] = useState([]);
    const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
    const addressDebounceRef = useRef(null);
    const addressWrapperRef = useRef(null);
    const suppressAutoGeocodeRef = useRef(false);

    // Refs cho input file
    const cccdFrontRef = useRef(null);
    const cccdBackRef = useRef(null);
    const avatarRef = useRef(null);
    const faceLeftRef = useRef(null);
    const faceRightRef = useRef(null);

    // ── Reset toàn bộ form khi modal đóng ────────────────────────────────────────
    // Đảm bảo mỗi lần mở lại modal đều bắt đầu từ đầu, không giữ data cũ
    useEffect(() => {
        if (isOpen) return; // chỉ reset khi đóng

        setCurrentStage(1);
        setHasManualAddressEdit(false);
        setFormData({
            dateOfBirth: '',
            bio: '',
            experienceYears: '',
            hometownCode: '',
            provinceCode: '',
            districtCode: '',
            wardCode: '',
            currentAddress: '',
            workingDistrictCodes: [],
            categoryIds: [],
            latitude: 16.0544,
            longitude: 108.2022,
        });
        setCityDistricts([]);
        setCityWards([]);
        setCccdFrontPreview(null);
        setCccdBackPreview(null);
        setAvatarPreview(null);
        setFaceLeftPreview(null);
        setFaceRightPreview(null);
        setCccdFrontFile(null);
        setCccdBackFile(null);
        setAvatarFile(null);
        setFaceLeftFile(null);
        setFaceRightFile(null);
        setError('');
        setSuccess('');
        setLoadingMessage('');
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
        suppressAutoGeocodeRef.current = false;
    }, [isOpen]);

    // Fetch danh sách tỉnh/thành và dịch vụ khi modal mở
    useEffect(() => {
        if (!isOpen) return;

        const fetchInitialData = async () => {
            setLoadingProvinces(true);
            setLoadingServices(true);
            try {
                const [provincesRes, servicesRes] = await Promise.all([
                    HelperRegistrationService.getProvinces(),
                    HelperRegistrationService.getCategories()
                ]);
                const provincesData = provincesRes?.data || provincesRes;
                const servicesData = servicesRes?.data || servicesRes;
                setProvinces(Array.isArray(provincesData) ? provincesData : []);
                setServices(normalizeCategoryOptions(servicesData));
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

    // Fetch danh sách quận/huyện khi chọn tỉnh/thành phố
    useEffect(() => {
        if (!formData.provinceCode) {
            setCityDistricts([]);
            setFormData(prev => ({ ...prev, districtCode: '', wardCode: '', workingDistrictCodes: [] }));
            return;
        }

        const fetchDistricts = async () => {
            setLoadingDistricts(true);
            try {
                const res = await HelperRegistrationService.getDistricts(formData.provinceCode);
                // Backend proxy: ApiResponse<Map> -> data.districts = [...]
                const payload = res?.data ?? res;
                const districts = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.districts)
                        ? payload.districts
                        : [];
                // Normalize code to string to avoid number/string mismatch in includes()
                setCityDistricts(districts.map(d => ({ ...d, code: String(d.code) })));
            } catch (err) {
                console.error('Lỗi khi tải danh sách quận/huyện:', err);
                setCityDistricts([]);
            } finally {
                setLoadingDistricts(false);
            }
        };

        fetchDistricts();
    }, [formData.provinceCode]);

    // Fetch danh sách phường/xã khi chọn quận/huyện
    useEffect(() => {
        if (!formData.districtCode) {
            setCityWards([]);
            setFormData(prev => ({ ...prev, wardCode: '' }));
            return;
        }

        const fetchWards = async () => {
            setLoadingWards(true);
            try {
                const res = await HelperRegistrationService.getWards(formData.districtCode);
                // Backend proxy: ApiResponse<Map> -> data.wards = [...]
                const payload = res?.data ?? res;
                const wards = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.wards)
                        ? payload.wards
                        : [];
                // Normalize code to string to avoid number/string mismatch in includes()
                setCityWards(wards.map(w => ({ ...w, code: String(w.code) })));
            } catch (err) {
                console.error('Lỗi khi tải danh sách phường/xã:', err);
                setCityWards([]);
            } finally {
                setLoadingWards(false);
            }
        };

        fetchWards();
    }, [formData.districtCode]);

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

    // ── Tự động ghim bản đồ bằng Goong (chính xác cho địa chỉ VN) ───────────
    useEffect(() => {
        if (!hasManualAddressEdit) return;
        if (!formData.provinceCode) return;

        const timer = setTimeout(async () => {
            if (suppressAutoGeocodeRef.current) {
                suppressAutoGeocodeRef.current = false;
                return;
            }

            const provinceName = provinces.find(p => p.code == formData.provinceCode)?.name;
            const districtName = cityDistricts.find(d => d.code == formData.districtCode)?.name;
            const wardName = cityWards.find(w => w.code == formData.wardCode)?.name;
            const street = formData.currentAddress?.trim() || null;

            const result = await geocodeAddressGoong({ street, wardName, districtName, provinceName });
            if (result) {
                setFormData(prev => ({
                    ...prev,
                    latitude: result.lat,
                    longitude: result.lng,
                }));
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [hasManualAddressEdit, formData.provinceCode, formData.districtCode, formData.wardCode, formData.currentAddress, provinces, cityDistricts, cityWards]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === 'provinceCode' || name === 'districtCode' || name === 'wardCode') {
            setHasManualAddressEdit(true);
        }

        if (name === 'currentAddress') {
            setHasManualAddressEdit(true);
            setFormData(prev => ({ ...prev, currentAddress: value }));

            if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
            if (value.trim().length > 2) {
                addressDebounceRef.current = setTimeout(async () => {
                    const suggestions = await autocompleteAddressGoong(value, {
                        lat: formData.latitude,
                        lng: formData.longitude,
                    });
                    setAddressSuggestions(suggestions);
                    setShowAddressSuggestions(suggestions.length > 0);
                }, 350);
            } else {
                setAddressSuggestions([]);
                setShowAddressSuggestions(false);
            }
            if (error) setError('');
            return;
        }

        if (type === 'checkbox') {
            const val = name === 'categoryIds' ? parseInt(value, 10) : value;
            setFormData(prev => ({
                ...prev,
                [name]: checked
                    ? [...prev[name], val]
                    : prev[name].filter(item => item !== val)
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

        if (error) setError('');
    };

    const toggleCategory = (categoryId) => {
        setFormData(prev => {
            const normalizedId = Number(categoryId);
            const currentlySelected = prev.categoryIds.includes(normalizedId);
            const nextCategoryIds = currentlySelected
                ? prev.categoryIds.filter((id) => id !== normalizedId)
                : [...prev.categoryIds, normalizedId];

            return {
                ...prev,
                categoryIds: nextCategoryIds,
            };
        });
        if (error) setError('');
    };

    const isCategorySelected = (categoryId) =>
        formData.categoryIds.includes(Number(categoryId));

    const handleSelectAddressSuggestion = async (suggestion) => {
        const streetOnly = suggestion.structured_formatting?.main_text || suggestion.description;
        setFormData(prev => ({ ...prev, currentAddress: streetOnly }));
        setShowAddressSuggestions(false);
        setAddressSuggestions([]);
        setHasManualAddressEdit(true);

        if (suggestion.place_id) {
            try {
                const coords = await getPlaceDetailGoong(suggestion.place_id);
                if (coords) {
                    suppressAutoGeocodeRef.current = true;
                    setFormData(prev => ({ ...prev, latitude: coords.lat, longitude: coords.lng }));
                }
            } catch (err) {
                console.error('Place detail geocoding failed:', err);
            }
        }
    };

    const handleMapLocationChange = (latlng) => {
        const { lat, lng } = latlng;
        setHasManualAddressEdit(false);
        setFormData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
        }));

        (async () => {
            try {
                const street = await reverseGeocodeStreet({ lat, lng });
                setFormData((prev) => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                    currentAddress: street || prev.currentAddress,
                }));
            } catch (err) {
                console.error('Lỗi reverse geocoding map:', err);
            }
        })();
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
            case 'faceLeft':
                setFaceLeftFile(file);
                setFaceLeftPreview(previewUrl);
                break;
            case 'faceRight':
                setFaceRightFile(file);
                setFaceRightPreview(previewUrl);
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
            case 'faceLeft':
                setFaceLeftFile(null);
                setFaceLeftPreview(null);
                if (faceLeftRef.current) faceLeftRef.current.value = '';
                break;
            case 'faceRight':
                setFaceRightFile(null);
                setFaceRightPreview(null);
                if (faceRightRef.current) faceRightRef.current.value = '';
                break;
        }
    };

    const validateStage1 = () => {
        if (!formData.dateOfBirth) {
            setError('Vui lòng nhập ngày sinh');
            return false;
        }
        if (!formData.hometownCode) {
            setError('Vui lòng chọn quê quán');
            return false;
        }
        if (!formData.provinceCode) {
            setError('Vui lòng chọn tỉnh/thành phố hiện tại');
            return false;
        }
        if (!formData.districtCode) {
            setError('Vui lòng chọn quận/huyện hiện tại');
            return false;
        }
        if (!formData.wardCode) {
            setError('Vui lòng chọn phường/xã hiện tại');
            return false;
        }
        if (!formData.currentAddress.trim()) {
            setError('Vui lòng nhập địa chỉ hiện tại');
            return false;
        }
        if (formData.workingDistrictCodes.length === 0) {
            setError('Vui lòng chọn ít nhất 1 quận muốn nhận việc');
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
        if (formData.categoryIds.length === 0) {
            setError('Vui lòng chọn ít nhất một danh mục dịch vụ');
            return false;
        }
        return true;
    };

    const validateStage2 = () => {
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
        if (!faceLeftFile) {
            setError('Vui lòng tải lên ảnh mặt bên trái');
            return false;
        }
        if (!faceRightFile) {
            setError('Vui lòng tải lên ảnh mặt bên phải');
            return false;
        }
        return true;
    };

    const handleContinue = async (e) => {
        e.preventDefault();
        if (!validateStage1()) return;

        setIsLoading(true);
        setLoadingMessage('Đang lưu hồ sơ...');
        setError('');
        setSuccess('');

        try {
            const hometownName = provinces.find(p => p.code == formData.hometownCode)?.name || '';
            const provinceName = provinces.find(p => p.code == formData.provinceCode)?.name || '';
            const districtName = cityDistricts.find(d => d.code == formData.districtCode)?.name || '';
            const wardName = cityWards.find(w => w.code == formData.wardCode)?.name || '';

            const workingDistricts = formData.workingDistrictCodes.map(code => {
                const dist = cityDistricts.find(d => d.code == code);
                return dist ? { code: String(code), name: dist.name } : null;
            }).filter(Boolean);

            const stage1Data = {
                dateOfBirth: formData.dateOfBirth,
                hometownName: hometownName,
                provinceName: provinceName,
                districtName: districtName,
                wardName: wardName,
                currentAddress: formData.currentAddress.trim(),
                workingDistricts: workingDistricts,
                bio: formData.bio.trim(),
                experienceYears: parseInt(formData.experienceYears),
                categoryIds: formData.categoryIds,
                latitude: formData.latitude,
                longitude: formData.longitude,
            };

            await HelperRegistrationService.registerStage1(stage1Data);
            setCurrentStage(2);
            setSuccess('Đã lưu thông tin giai đoạn 1. Vui lòng tiếp tục giai đoạn 2.');
        } catch (err) {
            console.error('Stage 1 Error:', err);
            setError(err.message || 'Có lỗi xảy ra khi lưu thông tin giai đoạn 1');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateStage2()) return;

        setIsLoading(true);
        setLoadingMessage('AI đang kiểm tra tính hợp lệ của CCCD...');
        setError('');
        setSuccess('');

        try {
            // Upload ảnh KYC lên Cloudinary song song
            const [cccdFrontUrl, cccdBackUrl, avatarUrl, faceLeftUrl, faceRightUrl] = await CloudinaryService.uploadMultiple([
                { file: cccdFrontFile, folder: 'kyc/cccd' },
                { file: cccdBackFile, folder: 'kyc/cccd' },
                { file: avatarFile, folder: 'kyc/avatar' },
                { file: faceLeftFile, folder: 'kyc/face' },
                { file: faceRightFile, folder: 'kyc/face' },
            ]);

            const stage2Data = {
                cccdFrontUrl: cccdFrontUrl,
                cccdBackUrl: cccdBackUrl,
                selfieUrl: avatarUrl,
                faceLeftUrl: faceLeftUrl,
                faceRightUrl: faceRightUrl,
            };

            await HelperRegistrationService.registerStage2(stage2Data);

            // PB-33: Verify AI and persist KYC in one flow
            const verifyResponse = await KycService.verify({
                cccdFrontUrl,
                selfieUrl: avatarUrl,
            });

            setSuccess(
                verifyResponse?.message ||
                'Xác minh khuôn mặt thành công! Hồ sơ đang chờ Admin duyệt kỹ năng.'
            );

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            user.kycStatus = 'IDENTITY_VERIFIED';
            localStorage.setItem('user', JSON.stringify(user));

            setTimeout(() => {
                if (onSuccess) onSuccess();
            }, 1500);
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
            setLoadingMessage('');
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
                        <img src={logoHomieConnect} alt="HomieConnect Logo" style={{ height: '48px', objectFit: 'contain' }} />
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
                                name="hometownCode"
                                className="kyc-select"
                                value={formData.hometownCode}
                                onChange={handleInputChange}
                                disabled={loadingProvinces}
                            >
                                <option value="">
                                    {loadingProvinces ? 'Đang tải...' : '-- Chọn quê quán --'}
                                </option>
                                {provinces.map((province) => (
                                    <option key={province.code} value={province.code}>
                                        {province.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Tỉnh/Thành phố hiện tại */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                Tỉnh/Thành phố hiện tại <span className="kyc-required">*</span>
                            </label>
                            <select
                                name="provinceCode"
                                className="kyc-select"
                                value={formData.provinceCode}
                                onChange={handleInputChange}
                                disabled={loadingProvinces}
                            >
                                <option value="">
                                    {loadingProvinces ? 'Đang tải...' : '-- Chọn tỉnh/thành phố --'}
                                </option>
                                {provinces.map((province) => (
                                    <option key={province.code} value={province.code}>
                                        {province.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Quận/Huyện hiện tại */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <polyline points="2 17 12 22 22 17" />
                                    <polyline points="2 12 12 17 22 12" />
                                </svg>
                                Quận/Huyện hiện tại <span className="kyc-required">*</span>
                            </label>
                            <select
                                name="districtCode"
                                className="kyc-select"
                                value={formData.districtCode}
                                onChange={handleInputChange}
                                disabled={!formData.provinceCode || loadingDistricts}
                            >
                                <option value="">
                                    {loadingDistricts ? 'Đang tải...' : '-- Chọn quận/huyện --'}
                                </option>
                                {cityDistricts.map((district) => (
                                    <option key={district.code} value={district.code}>
                                        {district.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Phường/Xã hiện tại */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                    <polyline points="2 17 12 22 22 17" />
                                    <polyline points="2 12 12 17 22 12" />
                                </svg>
                                Phường/Xã hiện tại <span className="kyc-required">*</span>
                            </label>
                            <select
                                name="wardCode"
                                className="kyc-select"
                                value={formData.wardCode}
                                onChange={handleInputChange}
                                disabled={!formData.districtCode || loadingWards}
                            >
                                <option value="">
                                    {loadingWards ? 'Đang tải...' : '-- Chọn phường/xã --'}
                                </option>
                                {cityWards.map((ward) => (
                                    <option key={ward.code} value={ward.code}>
                                        {ward.name}
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
                            <div className="kyc-autocomplete-wrapper" ref={addressWrapperRef}>
                                <input
                                    type="text"
                                    name="currentAddress"
                                    className="kyc-input"
                                    placeholder="Số nhà, đường/phố..."
                                    value={formData.currentAddress}
                                    onChange={handleInputChange}
                                    onFocus={() => addressSuggestions.length > 0 && setShowAddressSuggestions(true)}
                                    autoComplete="off"
                                />
                                {showAddressSuggestions && addressSuggestions.length > 0 && (
                                    <ul className="kyc-autocomplete-list">
                                        {addressSuggestions.map((s) => (
                                            <li
                                                key={s.place_id}
                                                className="kyc-autocomplete-item"
                                                onMouseDown={() => handleSelectAddressSuggestion(s)}
                                            >
                                                <svg className="kyc-autocomplete-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                                                </svg>
                                                <span>{s.structured_formatting?.main_text || s.description}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Bản đồ chọn vị trí */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                Ghim vị trí bản đồ <span className="kyc-required">*</span>
                            </label>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                Nhấp vào bản đồ để ghim vị trí chính xác của bạn.
                            </div>
                            <div style={{ height: '250px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #e2e8f0' }}>
                                <MapGoongComponent
                                    latitude={formData.latitude}
                                    longitude={formData.longitude}
                                    onLocationChange={handleMapLocationChange}
                                    height="250px"
                                />
                            </div>
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
                                {formData.provinceCode
                                    ? 'Chọn các quận/huyện bạn muốn làm việc:'
                                    : 'Vui lòng chọn Tỉnh/Thành phố hiện tại trước'}
                            </div>
                            {loadingDistricts ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
                            ) : cityDistricts.length > 0 ? (
                                <div style={{
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '0.5rem'
                                }}>
                                    {cityDistricts.map((district) => (
                                        <label
                                            key={district.code}
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
                                                name="workingDistrictCodes"
                                                value={district.code}
                                                checked={formData.workingDistrictCodes.includes(district.code)}
                                                onChange={handleInputChange}
                                                style={{ marginRight: '0.5rem' }}
                                            />
                                            {district.name}
                                        </label>
                                    ))}
                                </div>
                            ) : formData.provinceCode ? (
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
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                                    gap: '0.75rem'
                                }}>
                                    {services.map((cat) => {
                                        const selected = isCategorySelected(cat.categoryId);
                                        return (
                                            <label
                                                key={cat.categoryId}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '0.75rem',
                                                    border: selected ? '2px solid #346252' : '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    backgroundColor: selected ? '#f0faf5' : 'white',
                                                    transition: 'all 0.2s',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleCategory(cat.categoryId)}
                                                    style={{ accentColor: '#346252', width: '16px', height: '16px', flexShrink: 0 }}
                                                />
                                                <span style={{ fontSize: '0.9rem', fontWeight: selected ? '600' : '400', color: selected ? '#1b4332' : '#334155' }}>
                                                    {cat.categoryName}
                                                </span>
                                            </label>
                                        );
                                    })}
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
                        <div className="kyc-form-group">

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

                        {/* Ảnh mặt trái & phải */}
                        <div className="kyc-form-group">
                            <label>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                Ảnh khuôn mặt bên trái & bên phải <span className="kyc-required">*</span>
                            </label>
                            <div className="kyc-image-row">
                                <div>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem' }}>Mặt bên trái</p>
                                    <div
                                        className={`kyc-upload-area ${faceLeftPreview ? 'has-file' : ''}`}
                                        onClick={() => faceLeftRef.current?.click()}
                                    >
                                        <input
                                            ref={faceLeftRef}
                                            type="file"
                                            accept="image/*"
                                            className="kyc-upload-input"
                                            onChange={(e) => handleFileSelect(e, 'faceLeft')}
                                        />
                                        {faceLeftPreview ? (
                                            <div className="kyc-image-preview-wrapper">
                                                <img src={faceLeftPreview} alt="Mặt bên trái" className="kyc-image-preview" />
                                                <button
                                                    type="button"
                                                    className="kyc-remove-image"
                                                    onClick={(e) => { e.stopPropagation(); removeImage('faceLeft'); }}
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

                                <div>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.4rem' }}>Mặt bên phải</p>
                                    <div
                                        className={`kyc-upload-area ${faceRightPreview ? 'has-file' : ''}`}
                                        onClick={() => faceRightRef.current?.click()}
                                    >
                                        <input
                                            ref={faceRightRef}
                                            type="file"
                                            accept="image/*"
                                            className="kyc-upload-input"
                                            onChange={(e) => handleFileSelect(e, 'faceRight')}
                                        />
                                        {faceRightPreview ? (
                                            <div className="kyc-image-preview-wrapper">
                                                <img src={faceRightPreview} alt="Mặt bên phải" className="kyc-image-preview" />
                                                <button
                                                    type="button"
                                                    className="kyc-remove-image"
                                                    onClick={(e) => { e.stopPropagation(); removeImage('faceRight'); }}
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
                                        {loadingMessage || 'Đang gửi hồ sơ...'}
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
