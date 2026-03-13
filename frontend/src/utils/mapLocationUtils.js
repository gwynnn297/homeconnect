const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const GOONG_AUTOCOMPLETE_URL = 'https://rsapi.goong.io/Place/AutoComplete';

export const cleanLocationName = (name) =>
    name?.replace(/^(Tỉnh|Thành phố|Quận|Huyện|Phường|Xã)\s+/i, '') || '';

export const buildGeocodeQueries = ({ street, wardName, districtName, provinceName }) => {
    const hasFullAddress = provinceName && districtName && wardName;
    const queries = [];

    if (hasFullAddress && street) {
        queries.push([
            street,
            cleanLocationName(wardName),
            cleanLocationName(districtName),
            cleanLocationName(provinceName),
        ].join(', '));
    }

    if (hasFullAddress) {
        queries.push([
            cleanLocationName(wardName),
            cleanLocationName(districtName),
            cleanLocationName(provinceName),
        ].join(', '));
    }

    if (districtName) {
        queries.push([
            cleanLocationName(districtName),
            cleanLocationName(provinceName),
        ].join(', '));
    }

    if (provinceName) {
        queries.push(cleanLocationName(provinceName));
    }

    return queries;
};

export const geocodeFirstMatch = async (queries) => {
    for (const query of queries) {
        try {
            const res = await fetch(
                `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`
            );
            const data = await res.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                };
            }
        } catch (error) {
            console.error('Geocoding failed:', error);
        }
    }
    return null;
};

export const autocompleteAddressGoong = async (input, { lat, lng } = {}) => {
    const apiKey = import.meta.env.VITE_GOONG_REST_API_KEY
        || import.meta.env.VITE_GOONG_JS_KEY
        || '';
    if (!apiKey || !input.trim()) return [];
    try {
        let url = `${GOONG_AUTOCOMPLETE_URL}?api_key=${apiKey}&input=${encodeURIComponent(input)}&sessiontoken=${Date.now()}`;
        if (lat && lng) {
            url += `&location=${lat},${lng}&radius=5000`;
        }
        const res = await fetch(url);
        const data = await res.json();
        return data?.predictions || [];
    } catch {
        return [];
    }
};

export const geocodeAddressGoong = async ({ street, wardName, districtName, provinceName }) => {
    const apiKey = import.meta.env.VITE_GOONG_REST_API_KEY
        || import.meta.env.VITE_GOONG_JS_KEY
        || '';
    if (!apiKey) return null;

    // Build queries từ đầy đủ nhất → ít chi tiết nhất (fallback)
    // Giữ nguyên tên đầy đủ (Thành phố, Quận, Phường...) vì Goong hiểu tiếng Việt natively
    const queries = [];
    if (street && wardName && districtName && provinceName) {
        queries.push([street, wardName, districtName, provinceName].join(', '));
    }
    if (wardName && districtName && provinceName) {
        queries.push([wardName, districtName, provinceName].join(', '));
    }
    if (districtName && provinceName) {
        queries.push([districtName, provinceName].join(', '));
    }
    if (provinceName) {
        queries.push(provinceName);
    }

    for (const address of queries) {
        try {
            const res = await fetch(
                `https://rsapi.goong.io/Geocode?address=${encodeURIComponent(address)}&api_key=${apiKey}`
            );
            const data = await res.json();
            const location = data?.results?.[0]?.geometry?.location;
            if (location?.lat && location?.lng) {
                return { lat: location.lat, lng: location.lng };
            }
        } catch { /* tiếp tục fallback */ }
    }
    return null;
};

export const getPlaceDetailGoong = async (placeId) => {
    const apiKey = import.meta.env.VITE_GOONG_REST_API_KEY
        || import.meta.env.VITE_GOONG_JS_KEY
        || '';
    if (!apiKey || !placeId) return null;
    try {
        const res = await fetch(
            `https://rsapi.goong.io/Place/Detail?place_id=${encodeURIComponent(placeId)}&api_key=${apiKey}`
        );
        const data = await res.json();
        const location = data?.result?.geometry?.location;
        if (location?.lat && location?.lng) {
            return { lat: location.lat, lng: location.lng };
        }
        return null;
    } catch {
        return null;
    }
};

export const reverseGeocodeStreet = async ({ lat, lng }) => {
    const res = await fetch(
        `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`
    );
    const data = await res.json();
    const addr = data?.address || {};

    return (
        [addr.house_number, addr.road].filter(Boolean).join(' ')
        || addr.road
        || addr.pedestrian
        || addr.neighbourhood
        || addr.suburb
        || ''
    );
};

