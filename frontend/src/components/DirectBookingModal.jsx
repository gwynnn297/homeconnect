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

    // Pre-fill from selected slot if coming from profile schedule
    useEffect(() => {
        if (helper?.selectedSlot) {
            setWorkDate(helper.selectedSlot.date);
            if (helper.selectedSlot.time) {
                const [h, m] = helper.selectedSlot.time.split(':').map(Number);
                setStartHour(h);
                setStartMinute(m);
            }
        }
    }, [helper]);

    // Address & Location
    const [addressDetail, setAddressDetail] = useState('');
    const [addressId, setAddressId] = useState(null);
    const [lat, setLat] = useState(null);
    const [lng, setLng] = useState(null);
    const [provinceCode, setProvinceCode] = useState('');
    const [districtCode, setDistrictCode] = useState('');
    const [wardCode, setWardCode] = useState('');
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
    const [isEditMode, setIsEditMode] = useState(false);
    const [numChildren, setNumChildren] = useState(1);
    const [paintItems, setPaintItems] = useState(1);
    const [shopAmount, setShopAmount] = useState('');
    const [taskerAdvance, setTaskerAdvance] = useState(false);
    const [taskerShop, setTaskerShop] = useState(false);
    const [discountInfo, setDiscountInfo] = useState(null);

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
                const list = Array.isArray(res) ? res : (res?.data?.data || res?.data || []);
                setSubServices(list);
            })
            .catch(() => setSubServices([]));
        setSelectedSubs([]);
        setEstimatedPrice(null);

        if (catId === CAT_HOME_CLEAN) {
            setWorkSize(50);
        } else {
            setWorkSize('');
        }

    }, [catId]);

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

                const def = finalAddresses.find(a => a.isDefault);
                if (def) {
                    handleSelectSaved(def);
                } else if (finalAddresses.length > 0) {
                    handleSelectSaved(finalAddresses[0]);
                } else {
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
        // Kiểm tra giới hạn 10 địa chỉ
        if (savedAddresses.length >= 10 && !isEditMode) {
            setToast({ type: 'error', message: 'Bạn chỉ được lưu tối đa 10 địa chỉ. Vui lòng xóa bớt địa chỉ cũ.' });
            return;
        }

        // 0. Kiểm tra xem địa chỉ này đã tồn tại trong danh sách đã lưu chưa
        const existing = savedAddresses.find(a => a.placeId === sug.place_id);
        if (existing) {
            setToast({ type: 'info', message: 'Địa chỉ này đã có trong danh sách của bạn.' });
            handleSelectSaved(existing);
            return;
        }

        setAddressDetail(sug.description);
        setShowSuggestions(false);

        const district = extractDistrict(sug.description);
        const initialValid = isDistrictValid(district);
        setIsDistrictSupported(initialValid);
        setUnsupportedDistrict(initialValid ? '' : district);

        try {
            const res = await apiClient.get(`/api/v1/addresses/detail-v2?placeId=${sug.place_id}`);
            const data = res?.data?.data || res?.data || {};

            const finalValid = isDistrictValid(data.districtName, data.districtCode);
            setIsDistrictSupported(finalValid);
            setUnsupportedDistrict(finalValid ? '' : data.districtName);
            
            const savePayload = {
                addressDetail: data.addressDetail || '',
                wardName: data.wardName || '',
                districtName: data.districtName || '',
                provinceName: data.provinceName || '',
                wardCode: data.wardCode || '',
                districtCode: data.districtCode || '',
                provinceCode: data.provinceCode || '',
                placeId: sug.place_id,
                latitude: data.latitude,
                longitude: data.longitude,
                type: 'OTHER',
                isDefault: false
            };

            let savedAddr;
            if (addressId && isEditMode) {
                const updateRes = await apiClient.put(`/api/v1/addresses/${addressId}`, savePayload);
                savedAddr = updateRes?.data?.data || updateRes?.data || updateRes;
                setToast({ type: 'success', message: 'Đã cập nhật địa chỉ.' });
            } else {
                const savedRes = await apiClient.post('/api/v1/addresses', savePayload);
                savedAddr = savedRes?.data?.data || savedRes?.data || savedRes;
            }

            if (savedAddr && savedAddr.addressId) {
                setAddressId(savedAddr.addressId);
                setSavedAddresses(prev => {
                    const filtered = prev.filter(a => a.addressId !== savedAddr.addressId);
                    return [savedAddr, ...filtered];
                });
            }

            setLat(data.latitude);
            setLng(data.longitude);
            setProvinceCode(data.provinceCode || '');
            setDistrictCode(data.districtCode || '');
            setWardCode(data.wardCode || '');
            setProvinceName(data.provinceName || '');
            setDistrictName(data.districtName || '');
            setWardName(data.wardName || '');
            setIsEditMode(false);
        } catch (err) {
            console.error("Goong detail/save error:", err);
        }
    };

    const getAddressLabel = (type) => {
        const t = String(type || '').toUpperCase();
        if (t === 'HOME') return { text: 'Nhà riêng', icon: '🏠' };
        if (t === 'OFFICE') return { text: 'Văn phòng', icon: '🏢' };
        return { text: 'Khác', icon: '📍' };
    };

    const isDistrictValid = (districtName, distCode) => {
        if (!helper.workingDistricts || helper.workingDistricts.length === 0) return true;
        if (!districtName && !distCode) return true;

        return helper.workingDistricts.some(d => {
            if (distCode && d.code) {
                return String(distCode) === String(d.code);
            }
            const cleanDist = (districtName || '').toLowerCase().replace(/^(quận|huyện|thành phố)\s+/i, '').trim();
            const supportDist = (d.name || d).toLowerCase().replace(/^(quận|huyện|thành phố)\s+/i, '').trim();
            return cleanDist === supportDist || supportDist.includes(cleanDist) || cleanDist.includes(supportDist);
        });
    };

    const extractDistrict = (fullAddress) => {
        if (!fullAddress) return null;
        const parts = fullAddress.split(',').map(p => p.trim());
        if (parts.length >= 2) {
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
        setProvinceCode(addr.provinceCode || '');
        setDistrictCode(addr.districtCode || '');
        setWardCode(addr.wardCode || '');
        setProvinceName(addr.provinceName || '');
        setDistrictName(addr.districtName || '');
        setWardName(addr.wardName || '');
        setShowSuggestions(false);
        setIsEditMode(false);

        const valid = isDistrictValid(addr.districtName, addr.districtCode);
        setIsDistrictSupported(valid);
        setUnsupportedDistrict(valid ? '' : addr.districtName);
    };

    const handleEditSavedAddress = (e, addr) => {
        e.stopPropagation();
        setAddressId(addr.addressId);
        
        // Hiển thị đầy đủ địa chỉ khi nhấn Sửa để người dùng dễ quan sát
        const full = [addr.addressDetail, addr.wardName, addr.districtName, addr.provinceName]
            .filter(Boolean)
            .join(', ');
        setAddressDetail(full);

        setIsEditMode(true);
        setLat(addr.latitude);
        setLng(addr.longitude);
        setProvinceCode(addr.provinceCode);
        setDistrictCode(addr.districtCode);
        setWardCode(addr.wardCode);
        setProvinceName(addr.provinceName);
        setDistrictName(addr.districtName);
        setWardName(addr.wardName);
        setShowSuggestions(false);
        // Scroll to or focus input if needed
        const input = document.querySelector('.db-addr-input-wrap input');
        if (input) input.focus();
    };

    const handleDeleteAddress = async (e, targetId) => {
        e.stopPropagation();
        if (!window.confirm("Bạn có chắc chắn muốn xóa địa chỉ này?")) return;
        try {
            await apiClient.delete(`/api/v1/addresses/${targetId}`);
            setSavedAddresses(prev => prev.filter(a => a.addressId !== targetId));
            if (targetId === addressId) {
                // Nếu đang chọn chính địa chỉ vừa xóa thì reset
                setAddressId(null);
                setAddressDetail('');
                setLat(null);
                setLng(null);
            }
            setToast({ type: 'success', message: 'Đã xóa địa chỉ.' });
        } catch (err) {
            console.error("Delete address error:", err);
            setToast({ type: 'error', message: err?.message || 'Không thể xóa địa chỉ. Vui lòng thử lại.' });
        }
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
                additionalData: buildAdditionalData()
            };
            const res = await apiClient.post('/api/v1/jobs/estimate', payload);
            const estPrice = res?.data?.data?.estimatedPrice ?? res?.data?.estimatedPrice ?? null;
            setEstimatedPrice(estPrice);
            
            // Calculate loyalty discount for UI display
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : null;
            const tier = String(user?.tier || 'BRONZE').toUpperCase();
            let discountRate = 0;
            if (tier === 'SILVER') discountRate = 0.05;
            else if (tier === 'GOLD') discountRate = 0.10;
            
            if (estPrice && discountRate > 0) {
                setDiscountInfo({
                    originalPrice: estPrice,
                    finalPrice: estPrice * (1 - discountRate),
                    discountAmount: estPrice * discountRate,
                    tierName: tier === 'SILVER' ? 'Bạc' : 'Vàng'
                });
            } else {
                setDiscountInfo(null);
            }
        } catch {
            setEstimatedPrice(null);
        } finally {
            setEstimating(false);
        }
    }, [catId, durationHours, selectedSubs, workSize, numPeople, numChildren, paintItems, shopAmount, taskerAdvance, taskerShop]);

    useEffect(() => { estimate(); }, [estimate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!workDate || !categoryId) {
            setToast({ type: 'error', message: 'Vui lòng điền đầy đủ thông tin!' });
            return;
        }
        const selectedMaxDur = helper?.selectedSlot?.maxDuration || 0;
        const totalRequestedDur = parseInt(durationHours, 10) + (catId === CAT_HOME_CLEAN ? selectedSubs.length : 0);

        if (selectedMaxDur > 0 && totalRequestedDur > selectedMaxDur) {
            setToast({ 
                type: 'error', 
                message: `Thợ chỉ rảnh ${selectedMaxDur} tiếng trong khung giờ này. Tổng thời gian đặt (${totalRequestedDur}h) vượt quá lịch rảnh!` 
            });
            return;
        }

        // Kiểm tra thời gian tối thiểu 30 phút nếu đặt cho hôm nay
        const todayStr = new Date().toISOString().split('T')[0];
        if (workDate === todayStr) {
            const now = new Date();
            const slotMinutes = startHour * 60 + startMinute;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            if (slotMinutes - nowMinutes < 30) {
                setToast({ type: 'error', message: 'Vui lòng chọn khung giờ cách hiện tại ít nhất 30 phút để thợ có thời gian chuẩn bị.' });
                return;
            }
        }

        setLoading(true);
        try {
            let actualAddressId = addressId;
            let finalAddressDetail = "";
            let finalPCode = provinceCode, finalDCode = districtCode, finalWCode = wardCode;
            let finalPName = provinceName, finalDName = districtName, finalWName = wardName;
            let finalLat = lat, finalLng = lng;

            // B. Nếu người dùng sửa tay (không qua Goong) -> Refresh lại thông tin hành chính
            if (!actualAddressId || (addressDetail && !wardCode)) {
                try {
                    const geoRes = await apiClient.get(`/api/v1/addresses/geocode?address=${encodeURIComponent(addressDetail)}`);
                    const g = geoRes?.data?.data || geoRes?.data;
                    if (g) {
                        finalAddressDetail = g.addressDetail;
                        finalPCode = g.provinceCode; finalDCode = g.districtCode; finalWCode = g.wardCode;
                        finalPName = g.provinceName; finalDName = g.districtName; finalWName = g.wardName;
                        finalLat = g.latitude; finalLng = g.longitude;

                        // Kiểm tra trùng lặp sau khi geocode (nếu gõ tay)
                        const existing = savedAddresses.find(a => 
                            (a.placeId && a.placeId === g.placeId) || 
                            (a.addressDetail === addressDetail && a.wardCode === g.wardCode)
                        );
                        if (existing && !isEditMode) {
                            setToast({ type: 'info', message: 'Địa chỉ bạn nhập đã có trong danh sách.' });
                            actualAddressId = existing.addressId;
                            // Cập nhật lại các thông tin đồng bộ để chuẩn bị đặt
                            finalLat = existing.latitude; finalLng = existing.longitude;
                            finalPCode = existing.provinceCode; finalDCode = existing.districtCode; finalWCode = existing.wardCode;
                        }
                    }
                } catch (e) {
                    console.warn("Auto-geocode failed, using existing state", e);
                }
            }

            // A. Nếu đang trong chế độ Sửa, cập nhật thông tin địa chỉ trước khi đặt
            if (actualAddressId && isEditMode) {
                const savePayload = {
                    addressDetail: finalAddressDetail || addressDetail,
                    provinceName: finalPName, provinceCode: finalPCode,
                    districtName: finalDName, districtCode: finalDCode,
                    wardName: finalWName, wardCode: finalWCode,
                    latitude: finalLat,
                    longitude: finalLng,
                    type: 'OTHER',
                    isDefault: false
                };
                await apiClient.put(`/api/v1/addresses/${actualAddressId}`, savePayload);
            } else if (!actualAddressId) {
                // Kiểm tra giới hạn 10 địa chỉ trước khi tạo mới
                if (savedAddresses.length >= 10) {
                    setToast({ type: 'error', message: 'Bạn chỉ được lưu tối đa 10 địa chỉ. Vui lòng xóa bớt địa chỉ cũ.' });
                    setLoading(false);
                    return;
                }

                // Nếu chưa có ID (người dùng gõ tay mà không chọn gợi ý), tạo mới luôn
                const savePayload = {
                    addressDetail: finalAddressDetail || addressDetail,
                    provinceName: finalPName, provinceCode: finalPCode,
                    districtName: finalDName, districtCode: finalDCode,
                    wardName: finalWName, wardCode: finalWCode,
                    latitude: finalLat,
                    longitude: finalLng,
                    type: 'OTHER',
                    isDefault: false
                };
                const res = await apiClient.post('/api/v1/addresses', savePayload);
                const newAddr = res?.data?.data || res?.data;
                if (newAddr?.addressId) {
                    actualAddressId = newAddr.addressId;
                }
            }
            setIsEditMode(false); // Reset sau khi xử lý xong địa chỉ

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
                provinceCode: finalPCode,
                districtCode: finalDCode,
                wardCode: finalWCode,
                provinceName: finalPName,
                districtName: finalDName,
                wardName: finalWName,
                latitude: finalLat,
                longitude: finalLng,
                workSize: getWorkSize(),
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
        const maxDur = helper?.selectedSlot?.maxDuration || 0;
        if (maxDur > 0 && h + selectedSubs.length > maxDur) {
            setToast({ type: 'warning', message: `Khung giờ thợ rảnh chỉ cho phép tối đa ${maxDur} tiếng (bao gồm cả dịch vụ con).` });
            return;
        }
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
                    
                    {helper.selectedSlot && (
                        <div className="db-selected-schedule-info">
                            <div className="db-schedule-badge">
                                <span className="db-schedule-icon"></span>
                                <span>Lịch đã chọn: <strong>{new Date(helper.selectedSlot.date).toLocaleDateString('vi-VN')}</strong></span>
                            </div>
                            <div className="db-schedule-badge">
                                <span className="db-schedule-icon"></span>
                                <span>Khung rảnh: <strong>{helper.selectedSlot.time.substring(0, 5)} - {helper.selectedSlot.endTime.substring(0, 5)}</strong> ({helper.selectedSlot.maxDuration}h)</span>
                            </div>
                        </div>
                    )}
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
                                            {[2, 3, 4, 6].filter(h => {
                                                const maxDur = helper?.selectedSlot?.maxDuration || 12;
                                                return h <= maxDur;
                                            }).map(h => <option key={h} value={h}>{h} giờ</option>)}
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
                                            {[2, 3, 4, 6, 8, 10].filter(h => {
                                                const maxDur = helper?.selectedSlot?.maxDuration || 12;
                                                return h <= maxDur;
                                            }).map(h => <option key={h} value={h}>{h} giờ</option>)}
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
                                            const maxDur = helper?.selectedSlot?.maxDuration || 12;
                                            const disabled = maxDur > 0 && h > maxDur;
                                            
                                            return (
                                                <button key={h} type="button"
                                                    className={`db-preset-card ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                                                    onClick={() => {
                                                        if (disabled) {
                                                            setToast({ type: 'warning', message: `Thợ chỉ rảnh ${maxDur} tiếng trong khung giờ này.` });
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
                                            {[2, 3, 4, 6, 8].filter(h => {
                                                const maxDur = helper?.selectedSlot?.maxDuration || 12;
                                                return h <= maxDur;
                                            }).map(h => <option key={h} value={h}>{h} giờ</option>)}
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
                                    {[2, 3, 4, 8].map(h => {
                                        const maxDur = helper?.selectedSlot?.maxDuration || 0;
                                        const disabled = maxDur > 0 && h > maxDur;
                                        return (
                                            <button key={h} type="button"
                                                className={`db-dur-chip ${parseInt(durationHours) === h ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                                                onClick={() => {
                                                    if (disabled) {
                                                        setToast({ type: 'warning', message: `Thợ chỉ rảnh ${maxDur} tiếng trong khung giờ này.` });
                                                    } else {
                                                        setDurationHours(h);
                                                    }
                                                }}
                                            >
                                                {h} giờ
                                            </button>
                                        );
                                    })}
                                    <input type="number" className="db-field db-dur-custom" value={durationHours}
                                        min={1} max={helper?.selectedSlot?.maxDuration || 12} 
                                        onChange={e => {
                                            const val = parseInt(e.target.value) || 1;
                                            const maxDur = helper?.selectedSlot?.maxDuration || 12;
                                            if (val > maxDur) {
                                                setToast({ type: 'warning', message: `Thợ chỉ rảnh tối đa ${maxDur} tiếng.` });
                                                setDurationHours(maxDur);
                                            } else {
                                                setDurationHours(val);
                                            }
                                        }} 
                                    />
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
                                                <div className="db-addr-item-detail">
                                                    {[addr.addressDetail, addr.wardName, addr.districtName, addr.provinceName]
                                                        .filter(Boolean)
                                                        .join(', ')}
                                                </div>
                                            </div>
                                            <div className="db-addr-item-actions">
                                                <button type="button" className="db-addr-edit" 
                                                    onClick={(e) => handleEditSavedAddress(e, addr)}>
                                                    Sửa
                                                </button>
                                                <button type="button" className="db-addr-delete" 
                                                    onClick={(e) => handleDeleteAddress(e, addr.addressId)}>
                                                    Xóa
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="db-addr-input-wrap">
                                <input type="text" className="db-field" value={addressDetail}
                                    placeholder="Nhập địa chỉ chi tiết..."
                                    onFocus={() => setShowSuggestions(true)}
                                    onChange={e => { 
                                        setAddressDetail(e.target.value); 
                                        setShowSuggestions(true); 
                                    }} required />
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
                            {discountInfo ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                        <span style={{ textDecoration: 'line-through', color: '#64748b', fontSize: '0.9em' }}>
                                            {formatVnd(discountInfo.originalPrice)}
                                        </span>
                                        <strong className="db-price-val" style={{ color: '#059669' }}>
                                            {formatVnd(discountInfo.finalPrice)}
                                        </strong>
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                                        (Đã giảm {discountInfo.tierName === 'Bạc' ? '5%' : '10%'} hạng {discountInfo.tierName})
                                    </span>
                                </div>
                            ) : (
                                <strong className="db-price-val">
                                    {estimating ? '...' : estimatedPrice != null ? formatVnd(estimatedPrice) : '—'}
                                </strong>
                            )}
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
