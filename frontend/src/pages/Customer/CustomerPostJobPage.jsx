import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import './CustomerPostJobPage.css';

const DEFAULT_LATITUDE = 10.762622;
const DEFAULT_LONGITUDE = 106.660172;

const SERVICE_INFOS = {
    1: { name: 'Dọn dẹp nhà cửa', icon: '🏡', color: '#4CAF50' },
    2: { name: 'Nấu ăn', icon: '🍳', color: '#FF9800' },
    3: { name: 'Đi chợ', icon: '🛒', color: '#9C27B0' },
    4: { name: 'Vệ sinh văn phòng', icon: '🏢', color: '#2196F3' },
    5: { name: 'Trông trẻ', icon: '👶', color: '#E91E63' },
    6: { name: 'Làm vườn', icon: '🌱', color: '#8BC34A' },
    7: { name: 'Sơn sửa', icon: '🔧', color: '#607D8B' },
};

const CustomerPostJobPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const serviceId = parseInt(searchParams.get('serviceId')) || 1;

    const [step, setStep] = useState(1);

    const [jobData, setJobData] = useState({
        serviceId: serviceId,
        addressDetail: '',
        latitude: DEFAULT_LATITUDE,
        longitude: DEFAULT_LONGITUDE,
        workDate: '',
        startTime: '',
        durationHours: 2,
        title: '',
        description: ''
    });

    const [estimateData, setEstimateData] = useState(null);
    const [loadingEstimate, setLoadingEstimate] = useState(false);
    const [loadingSubmit, setLoadingSubmit] = useState(false);

    const handleSelectAddress = (address) => {
        setJobData(prev => ({ ...prev, addressDetail: address }));
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
                serviceId: jobData.serviceId,
                addressDetail: jobData.addressDetail,
                latitude: jobData.latitude,
                longitude: jobData.longitude,
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

    const serviceInfo = SERVICE_INFOS[serviceId] || { name: 'Dịch vụ', icon: '✨', color: '#2f4858' };

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
    const [showNew, setShowNew] = useState(false);

    if (showNew) {
        return <NewAddressForm onClose={() => setShowNew(false)} onSubmit={onSelectAddress} />;
    }

    const savedAddresses = [
        { id: 1, name: 'Nhà riêng', address: '123 Nguyễn Văn Linh, Phường Tân Thuận Tây, Quận 7, TP. Hồ Chí Minh' },
        { id: 2, name: 'Văn phòng', address: '456 Lê Văn Việt, Phường Hiệp Phú, TP. Thủ Đức, TP. Hồ Chí Minh' },
        { id: 3, name: 'Nhà bố mẹ', address: '789 Trần Hưng Đạo, Phường Cầu Ông Lãnh, Quận 1, TP. Hồ Chí Minh' },
        { id: 4, name: 'Nhà bạn', address: '321 Phan Xích Long, Phường 2, Quận Phú Nhuận, TP. Hồ Chí Minh' }
    ];

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
                <button className="asc-new-address-btn" style={{ borderColor: serviceInfo.color, color: serviceInfo.color }} onClick={() => setShowNew(true)}>
                    <span className="asc-new-address-icon">+</span>
                    Tạo địa chỉ mới
                </button>

                <h2 className="asc-saved-title">Danh sách địa chỉ đã lưu</h2>
                <div className="asc-saved-list">
                    {savedAddresses.map(addr => (
                        <div className="asc-address-item" key={addr.id} onClick={() => onSelectAddress(addr.address)}>
                            <div className="asc-address-icon-wrap" style={{ backgroundColor: `${serviceInfo.color}15`, color: serviceInfo.color }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div className="asc-address-info">
                                <p className="asc-address-name">{addr.name}</p>
                                <p className="asc-address-detail">{addr.address}</p>
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

const NewAddressForm = ({ onClose, onSubmit }) => {
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);

    const [selectedProv, setSelectedProv] = useState('');
    const [selectedDist, setSelectedDist] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [street, setStreet] = useState('');

    const [loadingProv, setLoadingProv] = useState(false);
    const [loadingDist, setLoadingDist] = useState(false);
    const [loadingWard, setLoadingWard] = useState(false);

    useEffect(() => {
        setLoadingProv(true);
        apiClient.get('/api/v1/locations/provinces')
            .then(res => setProvinces(res.data || []))
            .catch(err => console.error("Failed to fetch provinces", err))
            .finally(() => setLoadingProv(false));
    }, []);

    const handleProvChange = (e) => {
        const provCode = e.target.value;
        setSelectedProv(provCode);
        setSelectedDist(''); setSelectedWard(''); setDistricts([]); setWards([]);
        
        if (provCode) {
            setLoadingDist(true);
            apiClient.get(`/api/v1/locations/provinces/${provCode}/districts`)
                .then(res => res.data && res.data.districts && setDistricts(res.data.districts))
                .catch(err => console.error(err))
                .finally(() => setLoadingDist(false));
        }
    };

    const handleDistChange = (e) => {
        const distCode = e.target.value;
        setSelectedDist(distCode);
        setSelectedWard(''); setWards([]);

        if (distCode) {
            setLoadingWard(true);
            apiClient.get(`/api/v1/locations/districts/${distCode}/wards`)
                .then(res => res.data && res.data.wards && setWards(res.data.wards))
                .catch(err => console.error(err))
                .finally(() => setLoadingWard(false));
        }
    };

    const handleSubmit = () => {
        const provName = provinces.find(p => p.code == selectedProv)?.name || '';
        const distName = districts.find(d => d.code == selectedDist)?.name || '';
        const wardName = wards.find(w => w.code == selectedWard)?.name || '';
        const fullAddress = `${street ? street + ', ' : ''}${wardName}, ${distName}, ${provName}`;
        onSubmit(fullAddress);
    };

    const canSubmit = selectedProv && selectedDist && selectedWard && street.trim();

    return (
        <div className="pj-card slide-up">
            <div className="pj-header">
                <button className="pj-back-btn" onClick={onClose}>&larr;</button>
                <div className="pj-header-title">Thêm địa chỉ mới</div>
            </div>
            <div className="pj-body">
                <div className="form-group">
                    <label className="form-label">Tỉnh / Thành phố</label>
                    <select className="form-control" value={selectedProv} onChange={handleProvChange} disabled={loadingProv}>
                        <option value="">Chọn Tỉnh / Thành phố</option>
                        {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Quận / Huyện</label>
                    <select className="form-control" value={selectedDist} onChange={handleDistChange} disabled={!selectedProv || loadingDist}>
                        <option value="">Chọn Quận / Huyện</option>
                        {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Phường / Xã</label>
                    <select className="form-control" value={selectedWard} onChange={e => setSelectedWard(e.target.value)} disabled={!selectedDist || loadingWard}>
                        <option value="">Chọn Phường / Xã</option>
                        {wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Số nhà, Tên đường</label>
                    <input type="text" className="form-control" placeholder="Ví dụ: 12A Ngõ 3..." value={street} onChange={e => setStreet(e.target.value)} />
                </div>
                <button className={`pj-btn-primary ${!canSubmit ? 'disabled' : ''}`} disabled={!canSubmit} onClick={handleSubmit}>
                    Xác nhận địa chỉ
                </button>
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

    const [preEstimate, setPreEstimate] = useState(null);
    const [loadingPrice, setLoadingPrice] = useState(false);

    useEffect(() => {
        const fetchPrice = async () => {
            setLoadingPrice(true);
            try {
                const res = await apiClient.post('/api/v1/jobs/estimate', {
                    serviceId: initialData.serviceId,
                    durationHours: durationHours
                });
                setPreEstimate(res.data);
            } catch (err) {
                console.error("Lỗi tính giá", err);
            } finally {
                setLoadingPrice(false);
            }
        };
        fetchPrice();
    }, [durationHours, initialData.serviceId]);

    const formatCurrency = (val) => {
        if (val === undefined || val === null) return '0 ₫';
        return val.toLocaleString('vi-VN') + ' ₫';
    };

    const handleSubmit = () => {
        onSubmit({
            workDate,
            startTime,
            durationHours,
            title,
            description
        }, preEstimate);
    };

    const isFormValid = workDate && startTime && durationHours > 0;

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

                <div className="form-row">
                    <div className="form-group half">
                        <label className="form-label">Ngày làm việc (*)</label>
                        <input type="date" className="form-control" value={workDate} onChange={e => setWorkDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                    </div>
                    <div className="form-group half">
                        <label className="form-label">Giờ bắt đầu (*)</label>
                        <input type="time" className="form-control" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Thời lượng (giờ) (*)</label>
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

                <div className="form-group">
                    <label className="form-label">Tiêu đề công việc</label>
                    <input type="text" className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Dọn dẹp chung cư 2 phòng ngủ..." />
                </div>

                <div className="form-group">
                    <label className="form-label">Ghi chú thêm (Không bắt buộc)</label>
                    <textarea className="form-control" rows="3" value={description} onChange={e => setDescription(e.target.value)} placeholder="Nhập yêu cầu đặc biệt của bạn cho người làm..."></textarea>
                </div>

                <button 
                    className={`pj-btn-primary ${!isFormValid ? 'disabled' : ''}`} 
                    disabled={!isFormValid} 
                    onClick={handleSubmit}
                    style={{ backgroundColor: serviceInfo.color }}
                >
                    Tiếp tục
                </button>
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
