import React, { useEffect, useRef, useState } from 'react';
import { Branch } from '../types';
import { HEADQUARTERS } from '../constants';

interface MapComponentProps {
  branches: Branch[];
  selectedBranch: Branch | null;
  onSelectBranch: (branch: Branch) => void;
  searchTerm: string;
  mapResetNonce: number;
}

const MapComponent: React.FC<MapComponentProps> = ({ branches, selectedBranch, onSelectBranch, searchTerm, mapResetNonce }) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Initialize Map
  // Initialize Map and Load Script
  useEffect(() => {
    const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      console.error("VITE_NAVER_MAP_CLIENT_ID is not defined");
      return;
    }

    const initMap = (centerLat?: number, centerLng?: number) => {
      console.log("Attempting to initialize map...");
      if (!mapElement.current) {
        console.error("Map element not found");
        return;
      }
      if (!window.naver) {
        console.error("Window.naver not found");
        return;
      }

      if (!mapRef.current) {
        try {
          console.log("Initializing Naver Map instance...");
          // Use provided coordinates or default to HEADQUARTERS
          const lat = centerLat || HEADQUARTERS.lat;
          const lng = centerLng || HEADQUARTERS.lng;

          // Use zoom 12 for a closer default view
          const zoomLevel = 12;

          const mapOptions = {
            center: new window.naver.maps.LatLng(lat, lng),
            zoom: zoomLevel,
            scaleControl: false,
            logoControl: false,
            mapDataControl: false,
            zoomControl: true,
            zoomControlOptions: {
              position: window.naver.maps.Position.TOP_RIGHT
            }
          };
          mapRef.current = new window.naver.maps.Map(mapElement.current, mapOptions);
          console.log("Naver Map initialized successfully");
          setIsMapLoaded(true);
        } catch (error) {
          console.error("Failed to initialize Naver Map:", error);
        }
      } else {
        console.log("Map already initialized");
      }
    };

    // Find headquarters from branches data
    const headquarters = branches.find(branch =>
      branch.name.toLowerCase().includes('본사') ||
      branch.description?.toLowerCase().includes('본사') ||
      branch.description?.toLowerCase().includes('headquarters')
    );

    // Check if script is already loaded
    if (window.naver) {
      console.log("Naver script already loaded");
      if (headquarters) {
        initMap(headquarters.lat, headquarters.lng);
      } else {
        initMap();
      }
      return;
    }

    // Check if script tag already exists
    const scriptId = 'naver-map-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const handleScriptLoad = () => {
      console.log("Naver script loaded");
      if (headquarters) {
        initMap(headquarters.lat, headquarters.lng);
      } else {
        initMap();
      }
    };

    if (!script) {
      console.log("Creating new Naver script tag...");
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
      script.async = true;
      script.onload = handleScriptLoad;
      script.onerror = () => {
        console.error("Failed to load Naver Map script");
        alert("네이버 지도 스크립트 로드 실패. Client ID를 확인해주세요.");
      };
      document.head.appendChild(script);
    } else {
      console.log("Naver script tag exists, waiting for load...");
      script.addEventListener('load', handleScriptLoad);
    }

    return () => {
      if (script) {
        script.removeEventListener('load', handleScriptLoad);
      }
    };
  }, [branches]);

  // Handle Markers
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;

    console.log(`Updating markers for ${branches.length} branches`);
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current.clear();

    // Check if mobile device
    const isMobile = window.innerWidth < 768;

    // Create custom red pin icon for mobile only
    const mobileCustomIcon = isMobile ? {
      content: `<div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
        <svg width="32" height="32" viewBox="0 0 96 182" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(0,182) scale(0.1,-0.1)">
            <path d="M410 1734 c-110 -30 -199 -105 -253 -214 -30 -60 -32 -72 -32 -170 0 -94 3 -111 27 -160 78 -159 209 -237 383 -228 110 6 191 44 268 128 75 81 100 147 101 265 1 81 -2 97 -30 155 -38 81 -83 133 -151 177 -93 59 -204 76 -313 47z m97 -134 c89 -54 83 -199 -10 -243 -154 -73 -279 120 -151 233 28 24 44 30 82 30 29 0 59 -8 79 -20z" fill="#EF4444"/>
          </g>
        </svg>
      </div>`,
      size: new window.naver.maps.Size(32, 32),
      anchor: new window.naver.maps.Point(16, 32)
    } : undefined;

    // Create red marker icon for desktop (larger, default Naver style)
    const desktopCustomIcon = !isMobile ? {
      content: `<div style="position: relative; width: 24px; height: 36px; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));">
        <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="markerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#EF4444;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#DC2626;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#B91C1C;stop-opacity:1" />
            </linearGradient>
            <radialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
              <stop offset="70%" style="stop-color:#f8f8f8;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#e5e5e5;stop-opacity:1" />
            </radialGradient>
          </defs>
          <path d="M12 0C5.37258 0 0 5.37258 0 12C0 19.6875 12 36 12 36C12 36 24 19.6875 24 12C24 5.37258 18.6274 0 12 0Z" fill="url(#markerGradient)"/>
          <circle cx="12" cy="12" r="5" fill="url(#innerGlow)" opacity="0.95"/>
          <circle cx="12" cy="12" r="4" fill="white"/>
        </svg>
      </div>`,
      size: new window.naver.maps.Size(24, 36),
      anchor: new window.naver.maps.Point(12, 36)
    } : undefined;

    const bounds = new window.naver.maps.LatLngBounds();
    let validMarkerCount = 0;

    // Create new markers
    branches.forEach(branch => {
      if (!Number.isFinite(branch.lat) || !Number.isFinite(branch.lng)) {
        return;
      }

      const markerOptions: any = {
        position: new window.naver.maps.LatLng(branch.lat, branch.lng),
        map: mapRef.current,
        clickable: true
      };

      // Add custom icon based on device type
      if (mobileCustomIcon) {
        markerOptions.icon = mobileCustomIcon;
      } else if (desktopCustomIcon) {
        markerOptions.icon = desktopCustomIcon;
      }

      const marker = new window.naver.maps.Marker(markerOptions);

      window.naver.maps.Event.addListener(marker, 'click', () => {
        onSelectBranch(branch);
      });

      bounds.extend(markerOptions.position);
      validMarkerCount += 1;
      markersRef.current.set(String(branch.id), marker);
    });

    if (selectedBranch) {
      return;
    }

    if (validMarkerCount > 0) {
      const trimmedSearch = searchTerm.trim();
      if (trimmedSearch) {
        mapRef.current.setCenter(bounds.getCenter());
        mapRef.current.setZoom(12, true);
        return;
      }

      mapRef.current.setCenter(new window.naver.maps.LatLng(HEADQUARTERS.lat, HEADQUARTERS.lng));
      mapRef.current.setZoom(12);
    }
  }, [isMapLoaded, branches, onSelectBranch, searchTerm, selectedBranch, mapResetNonce]);

  // Handle Selected Branch (Pan & InfoWindow)
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !selectedBranch) return;
    if (!Number.isFinite(selectedBranch.lat) || !Number.isFinite(selectedBranch.lng)) return;

    // Pan to location
    const { lat, lng } = selectedBranch;
    const targetLatLng = new window.naver.maps.LatLng(lat, lng);
    const zoomLevel = searchTerm.trim() ? 15 : 13;
    mapRef.current.setCenter(targetLatLng);
    mapRef.current.setZoom(zoomLevel, true);

    // Close existing info window
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    // Create and open new info window
    const contentString = `
      <div style="padding: 16px; min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <h4 style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: #1e293b;">${selectedBranch.name}</h4>
        <p style="margin: 0 0 4px; font-size: 13px; color: #475569;">${selectedBranch.address}</p>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
           <div style="display: flex; align-items: center; gap: 4px;">
             <span>📞</span> ${selectedBranch.phone}
           </div>
        </div>
      </div>
    `;

    const infoWindow = new window.naver.maps.InfoWindow({
      content: contentString,
      maxWidth: 320,
      backgroundColor: "#ffffff",
      borderColor: "#cbd5e1",
      borderWidth: 1,
      anchorSize: new window.naver.maps.Size(12, 12),
      anchorSkew: true,
      anchorColor: "#ffffff",
      pixelOffset: new window.naver.maps.Point(0, -6)
    });

    const selectedMarker = markersRef.current.get(String(selectedBranch.id));
    if (selectedMarker) {
      infoWindow.open(mapRef.current, selectedMarker);
      infoWindowRef.current = infoWindow;
    }

  }, [selectedBranch, isMapLoaded, branches, searchTerm]);

  // Fallback if script is missing
  if (!window.naver && !isMapLoaded) {
    // This fallback might flash before script loads, so we can render a loading state or the map container
    // But since we load dynamically, we should render the map container always.
  }

  return (
    <div className="w-full h-full relative z-0" style={{ minHeight: '400px' }}>
      <div ref={mapElement} className="w-full h-full outline-none" style={{ minHeight: '100%' }} />
    </div>
  );
};

export default MapComponent;
