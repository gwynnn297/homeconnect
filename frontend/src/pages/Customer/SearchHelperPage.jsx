import React, { useState, useEffect, useCallback } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import ProfileService from '../../services/ProfileService';
import './SearchHelperPage.css';

const SearchHelperPage = () => {
    const [helpers, setHelpers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [showDrawer, setShowDrawer] = useState(false);
    const [sortBy, setSortBy] = useState('rating'); // rating, experience

    const [filters, setFilters] = useState({
        serviceId: '',
        provinceCode: '48', // Default to Đà Nẵng
        district: '',
        minRating: '',
        hometownCode: ''
    });

    const fetchCategories = useCallback(async () => {
        try {
            const res = await ProfileService.getActiveCategories();
            setCategories(res?.data || []);
        } catch (err) { console.error("Error categories:", err); }
    }, []);

    const fetchProvinces = useCallback(async () => {
        try {
            const res = await ProfileService.getProvinces();
            setProvinces(res?.data || []);
        } catch (err) { console.error("Error provinces:", err); }
    }, []);

    const fetchDistricts = useCallback(async (pCode) => {
        if (!pCode) {
            setDistricts([]);
            return;
        }
        try {
            const res = await ProfileService.getDistricts(pCode);
            setDistricts(res?.data?.districts || []);
        } catch (err) { console.error("Error districts:", err); }
    }, []);

    const [userHomeInfo, setUserHomeInfo] = useState({ provinceCode: '48', district: '' });

    const fetchInitialDistrict = useCallback(async () => {
        try {
            const res = await ProfileService.getMyProfile();
            const profileData = res?.data;
            // Use numeric province_code directly returned from profile (no string matching needed)
            if (profileData?.provinceCode) {
                const pCode = String(profileData.provinceCode);
                const info = {
                    provinceCode: pCode,
                    district: profileData.districtCode || profileData.districtName || ''
                };
                setUserHomeInfo(info);
                setFilters(prev => ({
                    ...prev,
                    provinceCode: pCode,
                    district: '' // Mặc định tìm tất cả thợ trong tỉnh thay vì lọc theo quận nhà
                }));
                fetchDistricts(pCode);
            }
        } catch (err) {
            console.error("Error fetching user profile for default district:", err);
        }
    }, [fetchDistricts]);

    const searchHelpers = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                serviceId: filters.serviceId || undefined,
                district: filters.district || undefined,
                province: filters.provinceCode || undefined,
                minRating: filters.minRating || undefined,
                hometownCode: filters.hometownCode || undefined
            };
            const res = await ProfileService.searchHelpers(params);
            let results = res?.data || [];

            // Client-side sorting for better UX
            results.sort((a, b) => {
                if (sortBy === 'rating') return (b.ratingAverage || 0) - (a.ratingAverage || 0);
                if (sortBy === 'experience') return (b.experienceYears || 0) - (a.experienceYears || 0);
                return 0;
            });

            setHelpers(results);
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setLoading(false);
        }
    }, [filters, sortBy]);

    useEffect(() => {
        const init = async () => {
            await Promise.all([fetchCategories(), fetchProvinces()]);
            await fetchInitialDistrict();
            setLoading(false);
        };
        init();
    }, [fetchCategories, fetchProvinces, fetchInitialDistrict]);

    // Trình tự search: Khi filters thay đổi hoặc sortBy thay đổi
    useEffect(() => {
        searchHelpers();
    }, [filters, sortBy, searchHelpers]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));

        if (name === 'provinceCode') {
            fetchDistricts(value);
            setFilters(prev => ({ ...prev, district: '' }));
        }
    };

    const resetFilters = () => {
        setFilters({
            serviceId: '',
            provinceCode: userHomeInfo.provinceCode,
            district: userHomeInfo.district,
            minRating: '',
            hometownCode: ''
        });
        if (userHomeInfo.provinceCode) {
            fetchDistricts(userHomeInfo.provinceCode);
        }
    };

    return (
        <CustomerLayout>
            <div className="search-helper-container">
                {/* Filter Drawer Overlay - Moved to top level for better visibility */}
                {showDrawer && (
                    <div className="drawer-overlay" onClick={() => setShowDrawer(false)}>
                        <div className="drawer-content" onClick={e => e.stopPropagation()}>
                            <div className="drawer-header">
                                <h3>Bộ lọc nâng cao</h3>
                                <button className="close-drawer-btn" onClick={() => setShowDrawer(false)}>×</button>
                            </div>
                            <div className="drawer-body">
                                <div className="filter-group">
                                    <label>Dịch vụ</label>
                                    <select
                                        name="serviceId"
                                        value={filters.serviceId}
                                        onChange={handleFilterChange}
                                    >
                                        <option value="">Tất cả dịch vụ</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="filter-group">
                                    <label>Quận/Huyện</label>
                                    <select
                                        name="district"
                                        value={filters.district}
                                        onChange={handleFilterChange}
                                    >
                                        <option value="">Tất cả Quận/Huyện</option>
                                        {districts.map(d => (
                                            <option key={d.code} value={d.name}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="filter-group">
                                    <label>Đánh giá tối thiểu</label>
                                    <select
                                        name="minRating"
                                        value={filters.minRating}
                                        onChange={handleFilterChange}
                                    >
                                        <option value="">Mọi đánh giá</option>
                                        <option value="4.5">Từ 4.5 ⭐</option>
                                        <option value="4.0">Từ 4.0 ⭐</option>
                                        <option value="3.5">Từ 3.5 ⭐</option>
                                        <option value="3.0">Từ 3.0 ⭐</option>
                                    </select>
                                </div>

                                <div className="filter-group">
                                    <label>Quê quán (Đồng hương)</label>
                                    <select
                                        name="hometownCode"
                                        value={filters.hometownCode}
                                        onChange={handleFilterChange}
                                    >
                                        <option value="">Tất cả Tỉnh/Thành</option>
                                        {provinces.map(p => (
                                            <option key={p.code} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="drawer-footer">
                                <button className="drawer-reset-btn" onClick={resetFilters}>Làm mới</button>
                                <button className="drawer-apply-btn" onClick={() => setShowDrawer(false)}>Áp dụng</button>
                            </div>
                        </div>
                    </div>
                )}

                <header className="search-helper-header">
                    <div className="header-content-wrapper">
                        <div className="header-title-section">
                            <h1>Tìm kiếm Người giúp việc</h1>
                            <p>Lọc thợ đang Online và có phản hồi tốt nhất</p>
                        </div>
                        <div className="header-actions">
                            <div className="sort-box">
                                <label>Sắp xếp:</label>
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                    <option value="rating">Đánh giá cao nhất</option>
                                    <option value="experience">Kinh nghiệm nhiều nhất</option>
                                </select>
                            </div>
                            <button className="open-filter-btn" onClick={() => setShowDrawer(true)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                                </svg>
                                Bộ lọc nâng cao
                            </button>
                        </div>
                    </div>
                </header>

                <div className="search-helper-main">
                    {/* Results Grid */}
                    <div className="search-helper-results-full">
                        {loading ? (
                            <div className="loading-state">
                                <div className="spinner"></div>
                                <p>Đang tìm kiếm thợ phù hợp...</p>
                            </div>
                        ) : helpers.length > 0 ? (
                            <div className="helper-grid">
                                {helpers.map(helper => (
                                    <div key={helper.id} className="helper-card">
                                        <div className="helper-card-header">
                                            <div className="helper-avatar">
                                                {helper.avatarUrl ? (
                                                    <img src={helper.avatarUrl} alt={helper.fullName} />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {helper.fullName?.charAt(0) || 'H'}
                                                    </div>
                                                )}
                                                <span className="online-badge"></span>
                                            </div>
                                            <div className="helper-info">
                                                <h4>{helper.fullName}</h4>
                                                <div className="rating">
                                                    <span className="star">⭐</span>
                                                    <span className="score">{helper.ratingAverage || '0.0'}</span>
                                                    <span className="total">({helper.totalReviews || 0} đánh giá)</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="helper-card-body">
                                            <div className="helper-meta">
                                                <span className="meta-item">
                                                    <strong>Kinh nghiệm:</strong> {helper.experienceYears || 0} năm
                                                </span>
                                                <span className="meta-item">
                                                    <strong>Quê quán:</strong> {helper.hometownName || 'N/A'}
                                                </span>
                                            </div>
                                            <div className="helper-categories">
                                                {helper.categories?.slice(0, 3).map(cat => (
                                                    <span key={cat.id} className="cat-tag">{cat.name}</span>
                                                ))}
                                                {helper.categories?.length > 3 && <span className="cat-tag">+{helper.categories.length - 3}</span>}
                                            </div>
                                            <p className="helper-bio">{helper.bio || "Thợ chưa cập nhật giới thiệu..."}</p>
                                        </div>

                                        <div className="helper-card-footer">
                                            <button className="view-profile-btn" onClick={() => window.location.href = `/helpers/${helper.id}`}>
                                                Xem hồ sơ
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon">🔍</div>
                                <h3>Không tìm thấy thợ phù hợp</h3>
                                <p>Hãy thử thay đổi bộ lọc hoặc mở rộng phạm vi tìm kiếm của bạn.</p>
                                <button className="reset-btn-large" onClick={resetFilters}>Xóa bộ lọc</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </CustomerLayout>
    );
};

export default SearchHelperPage;
