import apiClient from "./apiClient";

const getMyProfile = () => {
    return apiClient.get('/api/v1/profile');
};

const updateProfile = (profileData) => {
    return apiClient.put('/api/v1/profile', profileData);
};

const getHelperProfessionalProfile = () => {
    return apiClient.get('/api/v1/helper/profile');
};

const updateHelperProfessionalProfile = (profileData) => {
    return apiClient.put('/api/v1/helper/profile', profileData);
};

const getPublicHelperProfile = (id) => {
    return apiClient.get(`/api/v1/helpers/${id}`);
};

const getAddressLabels = () => {
    return apiClient.get('/api/v1/address-labels');
};

const ProfileService = {
    getMyProfile,
    updateProfile,
    getHelperProfessionalProfile,
    updateHelperProfessionalProfile,
    getPublicHelperProfile,
    getAddressLabels
};

export default ProfileService;
