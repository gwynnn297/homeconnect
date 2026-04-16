const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const toDisplayableCloudinaryUrl = (url) => {
    if (!url || typeof url !== 'string') return url;

    const trimmed = url.trim();
    if (!trimmed.includes('res.cloudinary.com') || !trimmed.includes('/image/upload/')) {
        return trimmed;
    }

    // Ensure browser-friendly output (HEIC/HEIF -> JPG) and reasonable size.
    if (trimmed.includes('/image/upload/f_')) {
        return trimmed;
    }

    return trimmed.replace(
        '/image/upload/',
        '/image/upload/f_jpg,q_auto:good,w_1600,h_1600,c_limit/'
    );
};

/**
 * Service quản lý upload ảnh lên Cloudinary
 */
const CloudinaryService = {
    /**
     * Upload 1 file ảnh lên Cloudinary
     * @param {File} file - File ảnh cần upload
     * @param {string} folder - Thư mục con (ví dụ: 'kyc/cccd', 'kyc/avatar')
     * @returns {Promise<string>} URL ảnh đã upload
     */
    uploadImage: async (file, folder = 'kyc') => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', folder);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
            {
                method: 'POST',
                body: formData,
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Upload ảnh thất bại');
        }

        const data = await response.json();
        return toDisplayableCloudinaryUrl(data.secure_url); // URL HTTPS đã tối ưu để FE hiển thị ổn định
    },

    /**
     * Upload nhiều ảnh cùng lúc
     * @param {Array<{file: File, folder: string}>} files - Mảng các file và folder tương ứng
     * @returns {Promise<string[]>} Mảng URL ảnh đã upload
     */
    uploadMultiple: async (files) => {
        const promises = files.map(({ file, folder }) =>
            CloudinaryService.uploadImage(file, folder)
        );
        return Promise.all(promises);
    },
};

export default CloudinaryService;
