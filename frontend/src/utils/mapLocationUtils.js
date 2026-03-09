const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

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

