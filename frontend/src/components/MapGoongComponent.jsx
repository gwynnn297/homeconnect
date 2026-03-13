import React, { useEffect, useRef, useState } from 'react';

const GOONG_JS_CSS_ID = 'goong-js-css';
const GOONG_JS_SCRIPT_ID = 'goong-js-script';

const ensureGoongCss = () => {
    if (document.getElementById(GOONG_JS_CSS_ID)) {
        return;
    }

    const link = document.createElement('link');
    link.id = GOONG_JS_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.css';
    document.head.appendChild(link);
};

const ensureGoongScript = () =>
    new Promise((resolve, reject) => {
        if (window.goongjs) {
            resolve(window.goongjs);
            return;
        }

        const existingScript = document.getElementById(GOONG_JS_SCRIPT_ID);
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(window.goongjs));
            existingScript.addEventListener('error', () => reject(new Error('Không thể tải Goong JS SDK.')));
            return;
        }

        const script = document.createElement('script');
        script.id = GOONG_JS_SCRIPT_ID;
        script.src = 'https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/goong-js.js';
        script.async = true;
        script.onload = () => resolve(window.goongjs);
        script.onerror = () => reject(new Error('Không thể tải Goong JS SDK.'));
        document.body.appendChild(script);
    });

const MapGoongComponent = ({
    latitude,
    longitude,
    onLocationChange,
    height = '300px'
}) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const onLocationChangeRef = useRef(onLocationChange);
    const [mapError, setMapError] = useState('');

    const goongJsToken = import.meta.env.VITE_GOONG_JS_KEY
        || import.meta.env.VITE_GOONG_MAPTILES_KEY
        || import.meta.env.VITE_GOONG_API_KEY
        || '';
    const mapTilesKey = import.meta.env.VITE_GOONG_MAPTILES_KEY || goongJsToken;

    useEffect(() => {
        onLocationChangeRef.current = onLocationChange;
    }, [onLocationChange]);

    useEffect(() => {
        let isMounted = true;

        const initMap = async () => {
            if (!mapContainerRef.current || mapRef.current) {
                return;
            }

            if (!goongJsToken) {
                setMapError('Thiếu API key Goong. Vui lòng cấu hình VITE_GOONG_JS_KEY hoặc VITE_GOONG_MAPTILES_KEY.');
                return;
            }

            try {
                ensureGoongCss();
                const goongjs = await ensureGoongScript();

                if (!isMounted || !goongjs) {
                    return;
                }

                const containerEl = mapContainerRef.current;
                if (!containerEl || !(containerEl instanceof HTMLElement)) {
                    return;
                }

                goongjs.accessToken = mapTilesKey;

                const map = new goongjs.Map({
                    container: containerEl,
                    style: `https://tiles.goong.io/assets/goong_map_web.json?api_key=${mapTilesKey}`,
                    center: [longitude, latitude],
                    zoom: 14
                });

                map.on('error', (event) => {
                    const statusCode = event?.error?.status || event?.status;
                    if (statusCode === 403) {
                        setMapError('API key Goong bị từ chối (403). Kiểm tra quyền key hoặc domain whitelist trên Goong Console.');
                    }
                });

                map.addControl(new goongjs.NavigationControl(), 'top-right');

                markerRef.current = new goongjs.Marker({ color: '#346252' })
                    .setLngLat([longitude, latitude])
                    .addTo(map);

                map.on('click', (event) => {
                    const { lng, lat } = event.lngLat;
                    markerRef.current?.setLngLat([lng, lat]);
                    onLocationChangeRef.current?.({ lat, lng });
                });

                mapRef.current = map;
            } catch (error) {
                if (isMounted) {
                    setMapError(error?.message || 'Không thể khởi tạo bản đồ Goong.');
                }
            }
        };

        initMap();

        return () => {
            isMounted = false;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, [goongJsToken, mapTilesKey]);

    useEffect(() => {
        if (!mapRef.current || !markerRef.current) {
            return;
        }

        markerRef.current.setLngLat([longitude, latitude]);
        mapRef.current.flyTo({
            center: [longitude, latitude],
            zoom: Math.max(mapRef.current.getZoom(), 14),
            essential: true
        });
    }, [latitude, longitude]);

    if (mapError) {
        return (
            <div style={{
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                color: '#b91c1c',
                fontSize: '14px',
                padding: '12px',
                textAlign: 'center'
            }}>
                {mapError}
            </div>
        );
    }

    return <div ref={mapContainerRef} style={{ width: '100%', height }} />;
};

export default MapGoongComponent;
