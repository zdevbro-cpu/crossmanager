// Geocoding service using Naver Maps Geocoding API
export interface GeocodingResult {
    lat: number;
    lng: number;
}

/**
 * Convert address to coordinates using Naver Maps Geocoding API
 * @param address - Korean address string
 * @returns Promise with lat/lng coordinates or null if failed
 */
export const addressToCoordinates = async (address: string): Promise<GeocodingResult | null> => {
    const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim();
    const clientSecret = import.meta.env.VITE_NAVER_MAP_CLIENT_SECRET?.trim();
    const isProd = import.meta.env.PROD;
    const sendCredentials = !isProd;
    const searchClientId = import.meta.env.VITE_NAVER_SEARCH_CLIENT_ID?.trim();
    const searchClientSecret = import.meta.env.VITE_NAVER_SEARCH_CLIENT_SECRET?.trim();

    if (!clientId || (!clientSecret && sendCredentials)) {
        console.error('Naver Map credentials missing:', {
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret
        });
        return null;
    }

    const normalizeAddress = (input: string) => {
        return input
            .replace(/\([^)]*\)/g, ' ')
            .replace(/[，,]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const buildAddressVariants = (input: string) => {
        const variants = new Set<string>();
        const base = normalizeAddress(input);
        const storePattern = /(롯데마트|홈플러스|이마트|코스트코|트레이더스|백화점|롯데몰|신세계|현대백화점|갤러리아|AK플라자|메가마트|빅마트|하이마트)/g;
        const floorPattern = /(지하|지상)?\s*\d+\s*층|B\s*\d+\s*층|B\s*\d+/g;
        const regionExpansions: Record<string, string> = {
            '서울': '서울특별시',
            '부산': '부산광역시',
            '대구': '대구광역시',
            '인천': '인천광역시',
            '광주': '광주광역시',
            '대전': '대전광역시',
            '울산': '울산광역시',
            '세종': '세종특별자치시',
            '경기': '경기도',
            '강원': '강원도',
            '충북': '충청북도',
            '충남': '충청남도',
            '전북': '전라북도',
            '전남': '전라남도',
            '경북': '경상북도',
            '경남': '경상남도',
            '제주': '제주특별자치도'
        };

        const push = (value: string) => {
            const trimmed = normalizeAddress(value);
            if (trimmed) variants.add(trimmed);
        };

        push(input);
        push(base);
        const noStore = base.replace(storePattern, ' ');
        const noFloor = base.replace(floorPattern, ' ');
        const noStoreNoFloor = noStore.replace(floorPattern, ' ');
        push(noStore);
        push(noFloor);
        push(noStoreNoFloor);

        const regionKey = Object.keys(regionExpansions).find((key) => base.startsWith(`${key} `));
        if (regionKey) {
            const expanded = base.replace(`${regionKey} `, `${regionExpansions[regionKey]} `);
            push(expanded);
            push(expanded.replace(storePattern, ' '));
            push(expanded.replace(floorPattern, ' '));
            push(expanded.replace(storePattern, ' ').replace(floorPattern, ' '));
        }

        const roadMatch = base.match(/(.+?(로|길|대로)\s*\d+(?:-\d+)?)/);
        if (roadMatch) {
            push(roadMatch[1]);
        }

        return Array.from(variants);
    };

    const requestGeocode = async (query: string) => {
        const encodedAddress = encodeURIComponent(query);
        const url = `/api/naver/map-geocode/v2/geocode?query=${encodedAddress}`;

        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };
        if (sendCredentials) {
            headers['X-NCP-APIGW-API-KEY-ID'] = clientId!;
            headers['X-NCP-APIGW-API-KEY'] = clientSecret!;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            console.error('Geocoding API request failed:', response.status, errorBody.slice(0, 300));
            return null;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const body = await response.text().catch(() => '');
            console.error('Geocoding API returned non-JSON response:', body.slice(0, 300));
            return null;
        }

        const data = await response.json();

        if (data.addresses && data.addresses.length > 0) {
            const { x, y } = data.addresses[0];
            return {
                lat: parseFloat(y),
                lng: parseFloat(x),
            };
        }

        return null;
    };

    const tm128ToLatLng = (x: number, y: number): Promise<GeocodingResult | null> => {
        return new Promise((resolve) => {
            const naverObj = window.naver;
            if (!naverObj?.maps?.TransCoord || !naverObj?.maps?.Point) {
                resolve(null);
                return;
            }
            const point = new naverObj.maps.Point(x, y);
            naverObj.maps.TransCoord.fromTM128ToLatLng(point, (latlng: any) => {
                if (!latlng) {
                    resolve(null);
                    return;
                }
                const lat = typeof latlng.lat === 'function' ? latlng.lat() : latlng.y;
                const lng = typeof latlng.lng === 'function' ? latlng.lng() : latlng.x;
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                    resolve(null);
                    return;
                }
                resolve({ lat, lng });
            });
        });
    };

    const requestLocalSearch = async (query: string) => {
        const encodedQuery = encodeURIComponent(query);
        const url = isProd
            ? `/api/naver-search/v1/search/local.json?query=${encodedQuery}`
            : `https://openapi.naver.com/v1/search/local.json?query=${encodedQuery}`;

        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };

        if (!isProd) {
            if (!searchClientId || !searchClientSecret) {
                return null;
            }
            headers['X-Naver-Client-Id'] = searchClientId;
            headers['X-Naver-Client-Secret'] = searchClientSecret;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            console.error('Local search API request failed:', response.status, errorBody.slice(0, 300));
            return null;
        }

        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            return null;
        }

        const { mapx, mapy } = data.items[0];
        const x = Number(mapx);
        const y = Number(mapy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }

        const converted = await tm128ToLatLng(x, y);
        if (!converted) {
            console.warn('Local search returned TM128 coords but conversion failed:', { mapx, mapy });
        }
        return converted;
    };

    try {
        const variants = buildAddressVariants(address);
        for (const variant of variants) {
            const result = await requestGeocode(variant);
            if (result) {
                return result;
            }
        }

        for (const variant of variants) {
            const result = await requestLocalSearch(variant);
            if (result) {
                return result;
            }
        }

        console.warn('No geocoding results found for address:', address, 'variants:', variants);
        return null;
    } catch (error) {
        console.error('Error during geocoding:', error);
        return null;
    }
};

/**
 * Get current user location using browser Geolocation API
 * @returns Promise with lat/lng coordinates or null if failed
 */
export const getCurrentLocation = (): Promise<GeocodingResult | null> => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported by this browser');
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            (error) => {
                console.error('Error getting current location:', error);
                resolve(null);
            }
        );
    });
};

/**
 * Open Naver Map directions from current location to destination
 * @param destinationLat - Destination latitude
 * @param destinationLng - Destination longitude
 * @param destinationName - Destination name (optional)
 */
export const openNaverMapDirections = async (
    destinationLat: number,
    destinationLng: number,
    destinationName?: string
) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // On mobile, try to get current location to open the app with start point
    if (isMobile) {
        const currentLocation = await getCurrentLocation();

        if (currentLocation) {
            const dname = encodeURIComponent(destinationName || '목적지');
            const sname = encodeURIComponent('현재위치');

            // Use Naver Map app URL scheme
            const url = `nmap://route/car?slat=${currentLocation.lat}&slng=${currentLocation.lng}&sname=${sname}&dlat=${destinationLat}&dlng=${destinationLng}&dname=${dname}&appname=com.lasbranch`;

            // Fallback to web URL
            const webUrl = `https://map.naver.com/index.nhn?slng=${currentLocation.lng}&slat=${currentLocation.lat}&stext=${sname}&elng=${destinationLng}&elat=${destinationLat}&etext=${dname}&menu=route&pathType=1`;

            // Try to open app, fallback to web
            window.location.href = url;
            setTimeout(() => {
                window.open(webUrl, '_blank');
            }, 500);
            return;
        }
    }

    // Desktop: Open Web URL immediately without location check (avoids popup blockers and permissions)
    // We provide the destination, and let the user choose the start point (Current Location) on the Naver Map website.
    const dname = encodeURIComponent(destinationName || '목적지');
    const url = `https://map.naver.com/v5/directions/-/-/-/${destinationLng},${destinationLat},${dname}/-/car`;
    window.open(url, '_blank');
};
