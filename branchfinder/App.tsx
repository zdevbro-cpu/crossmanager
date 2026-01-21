import React, { useState, useEffect, useMemo } from 'react';
import { Branch } from './types';
import MapComponent from './components/MapComponent';
import BranchList from './components/BranchList';
import { Menu, X, LayoutGrid, Navigation } from 'lucide-react';
import { fetchBranches } from './services/supabase';
import { BRANCH_DB } from './constants';
import { openNaverMapDirections } from './services/geocoding';

function App() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mapResetNonce, setMapResetNonce] = useState(0);

  const filteredBranches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = branches.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    if (!term) return base;
    return base.filter((branch) => {
      const haystack = [
        branch.name,
        branch.address,
        branch.phone,
        branch.hours,
        branch.description,
        branch.manager
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [branches, searchTerm]);

  useEffect(() => {
    const loadBranches = async () => {
      const data = await fetchBranches();
      if (data && data.length > 0) {
        setBranches(data);
      } else {
        // Fallback to mock data if fetch fails or returns empty
        setBranches(BRANCH_DB);
      }
    };
    loadBranches();

    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          console.log('📍 현재 위치:', position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn('위치 정보를 가져올 수 없습니다:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (!selectedBranch) return;
    const stillVisible = filteredBranches.some(branch => branch.id === selectedBranch.id);
    if (!stillVisible) {
      setSelectedBranch(null);
    }
  }, [filteredBranches, selectedBranch]);

  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">

      {/* Sidebar (Responsive) */}
      <div
        className={`fixed md:relative z-20 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-80'
          } md:flex flex-col`}
      >
        <BranchList
          branches={filteredBranches}
          selectedBranch={selectedBranch}
          onSelectBranch={(branch) => {
            setSelectedBranch(branch);
            // On mobile, close sidebar when selecting
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
          onClose={() => setIsSidebarOpen(false)}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onClearSearch={() => {
            setSearchTerm('');
            setSelectedBranch(null);
            setMapResetNonce((value) => value + 1);
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Mobile Header */}
        <div className="md:hidden h-16 border-b border-slate-200 flex items-center px-4 justify-between z-10" style={{ backgroundColor: '#249689' }}>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-white"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-xl text-white">LAS매장찾기</span>
          <div className="w-8"></div> {/* Spacer */}
        </div>

        {/* Map Area */}
        <div className="flex-1 relative z-0">
          <MapComponent
            branches={filteredBranches}
            selectedBranch={selectedBranch}
            onSelectBranch={setSelectedBranch}
            searchTerm={searchTerm}
            mapResetNonce={mapResetNonce}
          />
        </div>

        {/* Selected Branch Info Overlay (Bottom Card on Mobile/Desktop) */}
        {selectedBranch && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:w-auto md:min-w-[400px] bg-white p-6 rounded-2xl shadow-xl z-10 border border-slate-100 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-bold text-slate-800">{selectedBranch.name}</h2>
              <button
                onClick={() => setSelectedBranch(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-600 text-sm mb-3 leading-relaxed">{selectedBranch.description}</p>
            <div className="mb-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">주소</span>
                <span className="text-slate-800 text-sm">{selectedBranch.address}</span>
              </div>
            </div>
            <div className="mb-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">연락처</span>
                <span className="text-slate-800 text-sm">{selectedBranch.phone}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  // Check current location first
                  if (!currentLocation) {
                    alert('현재 위치를 확인할 수 없습니다. 위치 권한을 허용해주세요.');
                    return;
                  }

                  const slat = currentLocation.lat;
                  const slng = currentLocation.lng;
                  const dlat = selectedBranch.lat;
                  const dlng = selectedBranch.lng;
                  const sname = encodeURIComponent('내 위치');
                  const dname = encodeURIComponent(selectedBranch.name);

                  // Naver Map app deep link
                  const appUrl = `nmap://route/public?slat=${slat}&slng=${slng}&dlat=${dlat}&dlng=${dlng}&sname=${sname}&dname=${dname}&appname=com.las.map`;

                  // Mobile web fallback
                  const webUrl = `https://m.map.naver.com/route.nhn?menu=route&sx=${slng}&sy=${slat}&ex=${dlng}&ey=${dlat}&sname=${sname}&ename=${dname}`;

                  // PC web fallback
                  const pcUrl = `https://map.naver.com/v5/directions/${slng},${slat},${sname}/${dlng},${dlat},${dname}/-/transit?c=15,0,0,0,dh`;

                  // Check if mobile
                  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

                  if (isMobile) {
                    // Try to open app
                    window.location.href = appUrl;

                    // Fallback to mobile web after 1 second
                    setTimeout(() => {
                      window.location.href = webUrl;
                    }, 1000);
                  } else {
                    // Open in new tab for PC
                    window.open(pcUrl, '_blank');
                  }
                }}
                className="flex-1 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: '#249689' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d7a6f'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#249689'}
              >
                <Navigation size={18} />
                길찾기
              </button>
              <button
                onClick={() => setSelectedBranch(null)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 px-4 rounded-lg font-semibold transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
