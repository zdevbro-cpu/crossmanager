import React from 'react';
import { Branch } from '../types';
import { MapPin, ChevronRight, Phone, LayoutGrid, X, Search } from 'lucide-react';
import logo from '../comm/favicon_logo.png';

interface BranchListProps {
  branches: Branch[];
  selectedBranch: Branch | null;
  onSelectBranch: (branch: Branch) => void;
  onClose?: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onClearSearch: () => void;
}

const BranchList: React.FC<BranchListProps> = ({
  branches,
  selectedBranch,
  onSelectBranch,
  onClose,
  searchTerm,
  onSearchTermChange,
  onClearSearch
}) => {
  return (
    <div className="bg-white h-full flex flex-col border-r border-slate-200">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: '#0f2d4a' }}>
        <button
          type="button"
          onClick={onClearSearch}
          className="flex items-center gap-2"
        >
          <img src={logo} alt="LAS logo" className="h-7 w-7 rounded" />
          <h2 className="text-xl font-bold text-white">LAS 매장찾기 ({branches.length}개 지점)</h2>
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-white/80 hover:text-white"
          >
            <X size={24} />
          </button>
        )}
      </div>
      <div className="p-3 border-b border-slate-200">
        <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600">
          <Search size={16} className="text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="지점 검색 (이름/주소/전화)"
            className="w-full bg-transparent outline-none text-slate-700 placeholder:text-slate-400"
          />
          {searchTerm.trim() && (
            <button
              type="button"
              onClick={onClearSearch}
              className="text-slate-400 hover:text-slate-600"
              aria-label="검색어 지우기"
            >
              <X size={16} />
            </button>
          )}
        </label>
      </div>
      <div className="flex-1 overflow-y-auto">
        {branches.map((branch) => (
          <button
            key={branch.id}
            onClick={() => onSelectBranch(branch)}
            className={`w-full text-left p-4 border-b border-slate-100 transition-colors hover:bg-slate-50 group ${selectedBranch?.id === branch.id ? 'border-l-4' : 'border-l-4 border-l-transparent'
              }`}
            style={selectedBranch?.id === branch.id ? { backgroundColor: 'rgba(36, 150, 137, 0.05)', borderLeftColor: '#249689' } : {}}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold ${selectedBranch?.id === branch.id ? '' : 'text-slate-800'}`}
                  style={selectedBranch?.id === branch.id ? { color: '#249689' } : {}}>
                  {branch.name}
                </h3>
                <div className="flex items-center text-xs text-slate-500 mt-1">
                  <MapPin size={12} className="mr-1 flex-shrink-0" />
                  <span className="truncate">{branch.address}</span>
                </div>
                <div className="flex items-center text-xs text-slate-600 mt-1">
                  <Phone size={12} className="mr-1 flex-shrink-0" />
                  <span>{branch.phone}</span>
                </div>
              </div>
              <ChevronRight size={16} className={`mt-1 ml-2 flex-shrink-0 transition-transform ${selectedBranch?.id === branch.id ? 'translate-x-1' : 'text-slate-300'}`}
                style={selectedBranch?.id === branch.id ? { color: '#249689' } : {}}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BranchList;
