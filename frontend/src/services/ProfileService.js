import apiClient from "./apiClient";

/**
 * Lấy hồ sơ cá nhân
 * Lấy thông tin cơ bản: Tên, Email, SĐT, Địa chỉ của User đang đăng nhập
 * @returns {Promise<Object>} User profile response
 */
const getMyProfile = () => {
    return apiClient.get('/api/v1/profile');
};

/**
 * Cập nhật hồ sơ cá nhân name/avatar/địa chỉ
 * Cho phép sửa đổi các thông tin cơ bản của tài khoản
 * @param {Object} profileData Common profile update request
 * @returns {Promise<Object>} Updated user profile response
 */
const updateProfile = (profileData) => {
    return apiClient.put('/api/v1/profile', profileData);
};

/**
 * Lấy hồ sơ năng lực (Helper)
 * Lấy thông tin chuyên môn: Kinh nghiệm, Kỹ năng, Bio của Helper
 * @returns {Promise<Object>} Helper profile response
 */
const getHelperProfessionalProfile = () => {
    return apiClient.get('/api/v1/helper/profile');
};

/**
 * Cập nhật hồ sơ năng lực (Helper)
 * Cập nhật các thông tin chuyên môn của Người giúp việc
 * @param {Object} profileData Helper professional profile request
 * @returns {Promise<Object>} Updated helper profile response
 */
const updateHelperProfessionalProfile = (profileData) => {
    return apiClient.put('/api/v1/helper/profile', profileData);
};

/**
 * Xem hồ sơ công khai của Helper
 * Dùng để hiển thị thông tin Helper cho Khách hàng xem trước khi đặt việc
 * @param {number|string} id User ID của Helper cần xem
 * @returns {Promise<Object>} Public helper profile response
 */
const getPublicHelperProfile = (id) => {
    return apiClient.get(`/api/v1/helpers/${id}`);
};

/**
 * Lấy danh sách các nhãn địa chỉ
 * Dùng để hiển thị trong dropdown cho FE chọn (HOME, OFFICE, vv)
 * @returns {Promise<Object>} List of address labels
 */
const getAddressLabels = () => {
    return apiClient.get('/api/v1/address-labels');
};

// --- External Location APIs (Proxy via Backend) ---

/**
 * Lấy danh sách Tỉnh/Thành
 * @returns {Promise<Object>} Danh sách tỉnh thành
 */
const getProvinces = () => {
    return apiClient.get('/api/v1/locations/provinces');
};

/**
 * Lấy danh sách Quận/Huyện theo Tỉnh
 * @param {string} provinceCode Mã tỉnh/thành phố
 * @returns {Promise<Object>} Danh sách quận huyện
 */
const getDistricts = (provinceCode) => {
    return apiClient.get(`/api/v1/locations/provinces/${provinceCode}/districts`);
};

/**
 * Lấy danh sách Phường/Xã theo Quận
 * @param {string} districtCode Mã quận/huyện
 * @returns {Promise<Object>} Danh sách phường xã
 */
const getWards = (districtCode) => {
    return apiClient.get(`/api/v1/locations/districts/${districtCode}/wards`);
};

/**
 * Lấy danh sách danh mục dịch vụ đang hoạt động
 * Backend: GET /api/v1/categories/active
 * Response: ApiResponse<List<CategorySimpleResponse>>
 * @returns {Promise<Object>} Danh sách danh mục active
 */
const getActiveCategories = () => {
    return apiClient.get('/api/v1/categories/active');
};

const ProfileService = {
    getMyProfile,
    updateProfile,
    getHelperProfessionalProfile,
    updateHelperProfessionalProfile,
    getPublicHelperProfile,
    getAddressLabels,
    getProvinces,
    getDistricts,
    getWards,
    getActiveCategories
};

export default ProfileService;
