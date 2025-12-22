import React, { useEffect, useState, useMemo } from 'react';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { RiskItem } from '../types/riskass';

interface RiskTableProps {
    items: RiskItem[];
    onUpdate: (items: RiskItem[]) => void;
    constructionType: string;
    filterStep: string;
    filterFactorType: string;
    filterFactorDetail: string;
    // Mode props
    mode: 'selection' | 'edit';
    selectedIds: Set<string>;
    onToggleSelection: (id: string, selected: boolean) => void;

}

const RiskTable: React.FC<RiskTableProps> = ({
    items,
    onUpdate,
    filterStep,
    filterFactorType,
    filterFactorDetail,
    mode,
    selectedIds,
    onToggleSelection
}) => {
    // Pagination State
    const [page, setPage] = useState(0);
    const [rowsPerPage] = useState(10); // Default to 10 as requested imply compact view? or strictly following 10 page numbers? sticking to 10 rows helps seeing numbers. defaults to 20? Let's use 20 standard.

    const adjustHeight = (element: Element) => {
        if (element instanceof HTMLTextAreaElement) {
            element.style.height = 'auto';
            element.style.height = `${element.scrollHeight}px`;
        }
    };

    useEffect(() => {
        // Auto-resize textareas
        setTimeout(() => {
            const textareas = document.querySelectorAll('textarea');
            textareas.forEach(t => adjustHeight(t));
        }, 0);
    }, [items, page]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>, field: keyof RiskItem) => {
        const id = e.target.getAttribute('data-id');
        if (id) {
            handleChange(id, field, e.target.value);
            adjustHeight(e.target);
        }
    };

    const handleChange = (id: string, field: keyof RiskItem, value: string) => {
        const newItems = items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        );
        onUpdate(newItems);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('삭제하시겠습니까?')) {
            onUpdate(items.filter(item => item.id !== id));
        }
    };



    // Filter Logic
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchStep = (item.step || '').toLowerCase().includes(filterStep.toLowerCase());
            const matchType = (item.risk_factor || '').toLowerCase().includes(filterFactorType.toLowerCase());
            const matchDetail = (item.risk_factor_detail || '').toLowerCase().includes(filterFactorDetail.toLowerCase());
            return matchStep && matchType && matchDetail;
        });
    }, [items, filterStep, filterFactorType, filterFactorDetail]);

    // Reset page if filter changes
    useEffect(() => {
        setPage(0);
    }, [filterStep, filterFactorType, filterFactorDetail]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredItems.length / rowsPerPage);
    const displayedItems = filteredItems.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 0 && newPage < totalPages) {
            setPage(newPage);
        }
    };

    // Generate Page Numbers (Current - 4 to Current + 5, limited by total)
    const getPageNumbers = () => {
        const pages = [];
        const start = Math.max(0, page - 4);
        const end = Math.min(totalPages, start + 10);

        for (let i = start; i < end; i++) {
            pages.push(i);
        }
        return pages;
    };

    // Column Definitions Helpers
    const RiskColGroup = () => (
        <colgroup>
            <col style={{ width: '50px' }} /> {/* No */}
            <col style={{ width: '150px' }} /> {/* Step */}
            <col style={{ width: '120px' }} /> {/* Factor Type */}
            <col style={{ width: '120px' }} /> {/* Factor Class */}
            <col style={{ width: '80px' }} /> {/* Risk Level */}
            <col style={{ width: '80px' }} /> {/* Measure Type */}
            <col style={{ width: 'auto' }} /> {/* Measure Detail */}
            <col style={{ width: '80px' }} /> {/* Residual Risk */}
            <col style={{ width: '50px' }} /> {/* Delete/Select */}
        </colgroup>
    );

    return (
        <div className="risk-table-wrapper">
            {/* Static Header Table */}
            <div className="risk-table-header-wrapper">
                <table className="risk-table">
                    <RiskColGroup />
                    <thead>
                        <tr>
                            <th rowSpan={2}>No</th>
                            <th rowSpan={2}>작업단계</th>
                            <th colSpan={2}>유해위험요인</th>
                            <th rowSpan={2}>위험성<br />결정</th>
                            <th colSpan={2}>위험성감소대책</th>
                            <th rowSpan={2}>잔여<br />위험성</th>
                            <th rowSpan={2}>
                                {mode === 'selection' ? '선택' : '삭제'}
                            </th>
                        </tr>
                        <tr>
                            <th>유형</th>
                            <th>분류</th>
                            <th>유형</th>
                            <th>대책</th>
                        </tr>
                    </thead>
                </table>
            </div>

            {/* Scrollable Body Table */}
            <div className="risk-table-body-wrapper">
                <table className="risk-table">
                    <RiskColGroup />
                    <tbody>
                        {displayedItems.map((item, index) => (
                            <tr key={item.id} className="animate-slide-in" style={{ animationDelay: `${index * 10}ms` }}>
                                <td className="text-center text-sub" style={{ verticalAlign: 'middle' }}>
                                    {(page * rowsPerPage) + index + 1}
                                </td>
                                <td>
                                    <textarea
                                        name="step"
                                        data-id={item.id}
                                        value={item.step}
                                        onChange={(e) => handleTextChange(e, 'step')}
                                        placeholder="작업단계"
                                        rows={2}
                                    />
                                </td>
                                <td>
                                    <textarea
                                        name="risk_factor"
                                        data-id={item.id}
                                        value={item.risk_factor}
                                        onChange={(e) => handleTextChange(e, 'risk_factor')}
                                        placeholder="유형"
                                        rows={2}
                                    />
                                </td>
                                <td>
                                    <textarea
                                        name="risk_factor_detail"
                                        data-id={item.id}
                                        value={item.risk_factor_detail || ''}
                                        onChange={(e) => handleTextChange(e, 'risk_factor_detail')}
                                        placeholder="분류"
                                        rows={2}
                                    />
                                </td>
                                <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                    <select
                                        value={item.risk_level}
                                        onChange={(e) => handleChange(item.id, 'risk_level', e.target.value)}
                                        className={`badge-${item.risk_level === '상' ? 'high' : item.risk_level === '중' ? 'med' : 'low'}`}
                                    >
                                        <option value="상">상</option>
                                        <option value="중">중</option>
                                        <option value="하">하</option>
                                    </select>
                                </td>
                                <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                    <select
                                        value={item.measure}
                                        onChange={(e) => handleChange(item.id, 'measure', e.target.value)}
                                        className={
                                            item.measure === '지침' ? 'measure-guideline' :
                                                item.measure === '사고' ? 'measure-accident' :
                                                    item.measure === 'HP' ? 'measure-hp' :
                                                        'measure-normal'
                                        }
                                    >
                                        <option value="">-</option>
                                        <option value="지침">지침</option>
                                        <option value="사고">사고</option>
                                        <option value="HP">HP</option>
                                    </select>
                                </td>
                                <td>
                                    <textarea
                                        name="measure_detail"
                                        data-id={item.id}
                                        value={item.measure_detail || ''}
                                        onChange={(e) => handleTextChange(e, 'measure_detail')}
                                        placeholder="대책"
                                        rows={2}
                                    />
                                </td>
                                <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                    <select
                                        value={item.residual_risk}
                                        onChange={(e) => handleChange(item.id, 'residual_risk', e.target.value)}
                                        className={`badge-${item.residual_risk === '상' ? 'high' : item.residual_risk === '중' ? 'med' : 'low'}`}
                                    >
                                        <option value="상">상</option>
                                        <option value="중">중</option>
                                        <option value="하">하</option>
                                    </select>
                                </td>
                                <td className="text-center" style={{ verticalAlign: 'middle' }}>
                                    {mode === 'selection' ? (
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(item.id)}
                                            onChange={(e) => onToggleSelection(item.id, e.target.checked)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                    ) : (
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="btn-icon danger center-icon" // Note: btn-icon might need custom style inside td or use simple button
                                            // Assuming global btn-icon works, if not we inline or update CSS. 
                                            // Based on new CSS, we should ensure clean style.
                                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                            title="삭제"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {displayedItems.length === 0 && (
                            <tr>
                                <td colSpan={9} className="text-center" style={{ padding: '2rem', color: 'var(--text-sub)' }}>
                                    데이터가 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="pagination-controls" style={{
                display: 'flex',
                justifyContent: 'center', // Center alignment
                alignItems: 'center',
                padding: '1rem',
                borderTop: '1px solid var(--border)',
                marginTop: '0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 0}
                        style={{
                            width: '32px',
                            height: '32px',
                            padding: '0',
                            borderRadius: '4px',
                            background: '#1e293b',
                            color: page === 0 ? '#64748b' : '#e2e8f0',
                            border: '1px solid #334155',
                            cursor: page === 0 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ChevronLeft size={16} />
                    </button>

                    {getPageNumbers().map(p => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            style={{
                                width: '32px',
                                height: '32px',
                                padding: '0',
                                borderRadius: '4px',
                                background: page === p ? 'var(--primary)' : '#1e293b',
                                color: page === p ? '#ffffff' : '#e2e8f0',
                                border: page === p ? '1px solid var(--primary)' : '1px solid #334155',
                                cursor: 'pointer',
                                fontWeight: page === p ? '600' : '400',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {p + 1}
                        </button>
                    ))}

                    <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages - 1}
                        style={{
                            width: '32px',
                            height: '32px',
                            padding: '0',
                            borderRadius: '4px',
                            background: '#1e293b',
                            color: page >= totalPages - 1 ? '#64748b' : '#e2e8f0',
                            border: '1px solid #334155',
                            cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

        </div>
    );
};

export default RiskTable;
