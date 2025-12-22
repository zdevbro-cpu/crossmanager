import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RiskTable from '../components/RiskTable';
import type { RiskAssessmentProject, RiskItem } from '../types/riskass';
import { BookOpen, FileSpreadsheet, Plus, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx';
import './RiskAssessmentEditor.css';

const STORAGE_KEY_PROJECT = 'cross-specialness-project-v1';
const API_BASE = '/api/sms';

function RiskAssessmentEditor() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Project State
    const [project, setProject] = useState<RiskAssessmentProject>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_PROJECT);
        if (saved) return JSON.parse(saved);
        return {
            id: crypto.randomUUID(),
            title: '신규 위험성평가',
            construction_type: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            items: []
        };
    });

    // Available Construction Types (from Server)
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);

    // Filter States
    const [filterStep, setFilterStep] = useState('');
    const [filterFactorType, setFilterFactorType] = useState('');
    const [filterFactorDetail, setFilterFactorDetail] = useState('');

    // Mode State
    const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Fetch Types on Mount
    const fetchTypes = async () => {
        try {
            const res = await fetch(`${API_BASE}/risk-standards/types`);
            if (!res.ok) throw new Error('Failed to fetch types');
            const data = await res.json();
            setAvailableTypes(data);
        } catch (err) {
            console.error(err);
            // Fallback or silent fail
        }
    };

    useEffect(() => {
        fetchTypes();
    }, []);

    // Save project to local storage on change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(project));
    }, [project]);

    // Cascading Filter Logic
    const uniqueSteps = Array.from(new Set(project.items.map(i => i.step).filter(Boolean))).sort();

    const uniqueTypes = (() => {
        let filtered = project.items;
        if (filterStep) {
            filtered = filtered.filter(i => i.step === filterStep);
        }
        return Array.from(new Set(filtered.map(i => i.risk_factor).filter(Boolean))).sort();
    })();

    const uniqueDetails = (() => {
        let filtered = project.items;
        if (filterStep) {
            filtered = filtered.filter(i => i.step === filterStep);
        }
        if (filterFactorType) {
            filtered = filtered.filter(i => i.risk_factor === filterFactorType);
        }
        return Array.from(new Set(filtered.map(i => i.risk_factor_detail).filter(Boolean))).sort();
    })();

    const handleStepChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilterStep(e.target.value);
        setFilterFactorType('');
        setFilterFactorDetail('');
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilterFactorType(e.target.value);
        setFilterFactorDetail('');
    };

    const handleUpdateItems = (newItems: RiskItem[]) => {
        if (viewMode === 'edit') {
            setProject(prev => {
                // Keep items that were NOT selected (not currently being edited)
                const otherItems = prev.items.filter(item => !selectedIds.has(item.id));
                // Merge with the updated state of selected items
                return {
                    ...prev,
                    items: [...otherItems, ...newItems],
                    updated_at: new Date().toISOString()
                };
            });
        } else {
            setProject(prev => ({ ...prev, items: newItems, updated_at: new Date().toISOString() }));
        }
    };



    const handleLearn = async () => {
        if (!project.construction_type) {
            alert('공종을 선택해주세요.');
            return;
        }

        let itemsToLearn = project.items;

        // In Edit Mode, learn only selected items
        if (viewMode === 'edit') {
            const selectedItems = project.items.filter(i => selectedIds.has(i.id));
            if (selectedItems.length === 0) {
                alert('학습할 항목을 선택해주세요.');
                return;
            }
            itemsToLearn = selectedItems;
        }

        const standardItems = itemsToLearn.map(({ id, action_officer, checker, ...rest }) => rest);

        try {
            const res = await fetch(`${API_BASE}/risk-standards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    construction_type: project.construction_type,
                    items: standardItems
                })
            });

            if (!res.ok) throw new Error('Failed to learn standards');

            const result = await res.json();
            alert(`${result.addedCount}건이 표준 DB에 새로 추가되었습니다.\n(${result.skippedCount}건은 이미 존재하는 중복 데이터로 제외됨)`);

            // Refresh types in case a new type was added (though we are using existing type here)
            fetchTypes();

        } catch (err) {
            console.error(err);
            alert('학습 중 오류가 발생했습니다.');
        }
    };

    const processImportData = (rows: any[]) => {
        // 1. Detect Header Row & Step Column
        let dataStartIndex = 0;
        let stepColIndex = -1;
        let headerRow: any[] = [];

        // Keywords to identify header row
        const headerKeywords = ['작업단계', 'step', '작업 내용'];

        // Find header row
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const row = rows[i] as any[];
            // Convert row to string array for search
            const rowStr = row.map(c => String(c || '').toLowerCase());

            // Find which column is 'Step'
            const foundIndex = rowStr.findIndex(cell => headerKeywords.some(k => cell.includes(k)));

            if (foundIndex !== -1) {
                dataStartIndex = i + 1;
                stepColIndex = foundIndex;
                headerRow = row;
                break;
            }
        }

        // Fallback if header not detected
        if (stepColIndex === -1) {
            // Assume standard template from now on: Index 1 is step (Index 0 is No)
            stepColIndex = 1;
        }

        // 2. Detect other columns dynamically based on header row
        let factorTypeColIndex = -1;
        let factorDetailColIndex = -1;
        let riskLevelColIndex = -1;
        let measureTypeColIndex = -1;
        let measureDetailColIndex = -1;
        let residualColIndex = -1;

        if (headerRow.length > 0) {
            headerRow.forEach((cell, idx) => {
                const c = String(cell || '').toLowerCase();
                // Skip Step Column
                if (idx === stepColIndex) return;

                // 1. Measure Type (Prioritize: contains 'Measure' + 'Type')
                if (c.includes('대책유형') || c.includes('measure type')) {
                    measureTypeColIndex = idx;
                }
                // 2. Measure Detail (Contains 'Measure' but NOT 'Type')
                else if ((c.includes('대책') || c.includes('measure')) && !c.includes('유형') && !c.includes('type')) {
                    measureDetailColIndex = idx;
                }
                // 3. Risk Factor Type (Contains 'Type' but NOT 'Measure')
                else if ((c.includes('유형') || c.includes('factor level 1')) && !c.includes('대책')) {
                    factorTypeColIndex = idx;
                }
                // 4. Factor Detail (Classification)
                else if (c.includes('분류') || c.includes('factor level 2')) {
                    factorDetailColIndex = idx;
                }
                // 5. Risk Level (Contains 'Risk' but NOT 'Residual' and NOT 'Measure')
                else if ((c.includes('위험성') || c.includes('risk')) && !c.includes('잔여') && !c.includes('residual') && !c.includes('대책')) {
                    riskLevelColIndex = idx;
                }
                // 6. Residual Risk (Contains 'Residual')
                else if (c.includes('잔여') || c.includes('residual')) {
                    residualColIndex = idx;
                }
            });
        }

        // Fallback to relative positions if columns not detected
        if (factorTypeColIndex === -1) factorTypeColIndex = stepColIndex + 1;
        if (factorDetailColIndex === -1) factorDetailColIndex = stepColIndex + 2;
        if (riskLevelColIndex === -1) riskLevelColIndex = stepColIndex + 3;
        if (measureTypeColIndex === -1) measureTypeColIndex = stepColIndex + 4;
        if (measureDetailColIndex === -1) measureDetailColIndex = stepColIndex + 5;
        if (residualColIndex === -1) residualColIndex = stepColIndex + 6;

        // 3. Map Data
        const importedItems: RiskItem[] = rows.slice(dataStartIndex)
            .filter((row: any) => {
                if (!row) return false;
                // Ensure strictly having step or key data
                return !!(row[stepColIndex] || row[stepColIndex + 1]);
            })
            .map((row: any) => {
                // Cast risk/residual to specific type
                const rawRisk = row[riskLevelColIndex];
                const riskLevel = (['상', '중', '하'].includes(rawRisk) ? rawRisk : '중') as '상' | '중' | '하';

                const rawResidual = row[residualColIndex];
                const residualRisk = (['상', '중', '하'].includes(rawResidual) ? rawResidual : '하') as '상' | '중' | '하';

                return {
                    id: crypto.randomUUID(),
                    step: row[stepColIndex] || '',
                    risk_factor: row[factorTypeColIndex] || '',
                    risk_factor_detail: row[factorDetailColIndex] || '',
                    risk_level: riskLevel,
                    measure: row[measureTypeColIndex] || '',
                    measure_detail: row[measureDetailColIndex] || '',
                    residual_risk: residualRisk,
                    action_officer: '',
                    checker: ''
                };
            });

        if (importedItems.length > 0) {
            setProject(prev => ({
                ...prev,
                items: [...prev.items, ...importedItems]
            }));

            // If in edit mode, select the new items
            if (viewMode === 'edit') {
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    importedItems.forEach(i => next.add(i.id));
                    return next;
                });
            }

            alert(`${importedItems.length}건의 데이터가 추가되었습니다.`);
        } else {
            alert('데이터를 읽을 수 없습니다.\n엑셀 파일 형식을 확인해주세요.\n(권장: 1행 헤더, 이후 데이터)');
        }
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        // Check if PapaParse is available (it was removed, need to check if we can live without or restore it)
        // Since user wants import, we should probably support Excel mostly. 
        // If CSV is needed, we need to reinstall PapaParse or use a simple splitter.
        // Assuming Excel for now as '엑셀자료' was mentioned.

        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // Convert to JSON array (array of arrays)
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            processImportData(jsonData);
        };
        reader.readAsBinaryString(file);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };


    return (
        <div className="page">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
            />
            <header className="page-header" style={{ alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button className="icon-button" onClick={() => navigate(-1)} title="뒤로 가기" style={{ marginLeft: '-0.5rem', backgroundColor: 'transparent', border: 'none' }}>
                            <ArrowLeft size={20} />
                        </button>
                        <p className="eyebrow" style={{ margin: 0 }}>SMS Module</p>
                    </div>
                    <h1>위험성 평가 데이터베이스</h1>
                    <p className="muted">
                        표준 항목을 필터링하고 편집하여 새로운 평가표를 작성합니다.
                    </p>
                </div>
            </header>

            {/* Show Filters & Construction Type ONLY in List Mode */}
            {viewMode === 'list' && (
                <div className="panel" style={{ marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {/* Search Filters */}
                        <div className="form-group" style={{ flex: 2, minWidth: '300px' }}>
                            <label>검색 필터</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select
                                    className="input"
                                    value={filterStep}
                                    onChange={handleStepChange}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">전체 작업단계</option>
                                    {uniqueSteps.map(step => (
                                        <option key={step} value={step}>{step}</option>
                                    ))}
                                </select>
                                <select
                                    className="input"
                                    value={filterFactorType}
                                    onChange={handleTypeChange}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">전체 유형</option>
                                    {uniqueTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                                <select
                                    className="input"
                                    value={filterFactorDetail}
                                    onChange={e => setFilterFactorDetail(e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">전체 분류</option>
                                    {uniqueDetails.map(detail => (
                                        <option key={detail} value={detail}>{detail}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ flex: 1, minWidth: '250px' }}>
                            <label>공종</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <select
                                    className="input"
                                    value={project.construction_type}
                                    onChange={async (e) => {
                                        const newType = e.target.value;

                                        // If empty type selected, clear everything
                                        if (!newType) {
                                            setProject(prev => ({ ...prev, construction_type: '', items: [] }));
                                            return;
                                        }

                                        // Removed confirmation as per user request

                                        try {
                                            const res = await fetch(`${API_BASE}/risk-standards?construction_type=${encodeURIComponent(newType)}`);
                                            if (!res.ok) throw new Error('Failed to load template');
                                            const data: any[] = await res.json();

                                            if (data.length === 0) {
                                                // If no data, just clear items
                                                setProject(prev => ({ ...prev, construction_type: newType, items: [] }));
                                                return;
                                            }

                                            const knownTypes = ['지침', '사고', 'HP'];

                                            const newItems = data.map(t => {
                                                let mType = t.measure || '';
                                                let mDetail = t.measure_detail || '';

                                                // HEURISTIC FIX: 
                                                // If database has content in 'measure' column but it's not a known type,
                                                // and 'measure_detail' is empty, treat 'measure' as the detail content.
                                                if (mType && !knownTypes.includes(mType) && !mDetail) {
                                                    mDetail = mType;
                                                    mType = ''; // Reset type to empty/default
                                                }

                                                return {
                                                    id: crypto.randomUUID(),
                                                    step: t.step || '',
                                                    risk_factor: t.risk_factor || '',
                                                    risk_factor_detail: t.risk_factor_detail || '',
                                                    risk_level: t.risk_level || '중',
                                                    measure: mType,
                                                    measure_detail: mDetail,
                                                    residual_risk: t.residual_risk || '하',
                                                    action_officer: '',
                                                    checker: ''
                                                };
                                            });

                                            setProject(prev => ({
                                                ...prev,
                                                construction_type: newType,
                                                items: newItems
                                            }));
                                        } catch (err) {
                                            console.error(err);
                                            alert('데이터를 불러오는 중 오류가 발생했습니다.');
                                        }
                                    }}
                                    style={{ flex: 1, height: '38px' }}
                                >
                                    <option value="">공종 선택</option>
                                    {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>

                                <button
                                    className="btn-secondary"
                                    style={{
                                        whiteSpace: 'nowrap',
                                        padding: '0 0.75rem',
                                        height: '38px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        border: '1px solid var(--border)'
                                    }}
                                    onClick={() => {
                                        if (selectedIds.size === 0) {
                                            const newItem: RiskItem = {
                                                id: crypto.randomUUID(),
                                                step: '',
                                                risk_factor: '',
                                                risk_factor_detail: '',
                                                risk_level: '중',
                                                measure: '',
                                                measure_detail: '',
                                                residual_risk: '하',
                                                action_officer: '',
                                                checker: ''
                                            };
                                            setProject(prev => ({ ...prev, items: [...prev.items, newItem] }));
                                            setSelectedIds(new Set([newItem.id]));
                                        }
                                        setViewMode('edit');
                                    }}
                                >
                                    편집 ({selectedIds.size})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {viewMode === 'edit' && (
                <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>선택 항목 편집</h2>
                        <span className="muted" style={{ fontSize: '0.85rem' }}>{selectedIds.size}개 항목 선택됨</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {/* Import Button Restored in Edit Mode */}
                        <button
                            className="btn-secondary"
                            onClick={triggerFileInput}
                            title="엑셀 파일 가져오기"
                        >
                            <FileSpreadsheet size={16} /> Import
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                const newItem: RiskItem = {
                                    id: crypto.randomUUID(),
                                    step: '',
                                    risk_factor: '',
                                    risk_factor_detail: '',
                                    risk_level: '중',
                                    measure: '',
                                    measure_detail: '',
                                    residual_risk: '하',
                                    action_officer: '',
                                    checker: ''
                                };
                                setProject(prev => ({ ...prev, items: [...prev.items, newItem] }));
                                setSelectedIds(prev => new Set([...prev, newItem.id]));
                            }}
                        >
                            <Plus size={16} /> 행 추가
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={handleLearn}
                            title="현재 내용을 표준 DB로 학습"
                        >
                            <BookOpen size={16} /> DB 추가
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                const selectedItems = project.items.filter(i => selectedIds.has(i.id));
                                if (selectedItems.length === 0) {
                                    alert('선택된 항목이 없습니다.');
                                    return;
                                }

                                const header = [
                                    ["순번", "작업단계(Step)", "유형(Factor Level 1)", "분류(Factor Level 2)", "위험성(상/중/하)", "감소대책유형(지침/사고/HP)", "감소대책(내용)", "잔여위험성(상/중/하)"]
                                ];

                                const data = selectedItems.map((item, idx) => [
                                    String(idx + 1),
                                    item.step,
                                    item.risk_factor,
                                    item.risk_factor_detail || '',
                                    item.risk_level,
                                    item.measure,
                                    item.measure_detail || '',
                                    item.residual_risk
                                ]);

                                const wb = XLSX.utils.book_new();
                                const ws = XLSX.utils.aoa_to_sheet([...header, ...data]);

                                // Auto-width
                                const wscols = [{ wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 15 }];
                                ws['!cols'] = wscols;

                                XLSX.utils.book_append_sheet(wb, ws, "위험성평가_결과");
                                XLSX.writeFile(wb, `위험성평가_결과_${new Date().toISOString().slice(0, 10)}.xlsx`);
                            }}
                        >
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => {
                                setViewMode('list');
                                setSelectedIds(new Set()); // Reset selections on complete
                            }}
                        >
                            편집 완료
                        </button>
                    </div>
                </div>
            )}

            <RiskTable
                items={viewMode === 'list' ? project.items : project.items.filter(i => selectedIds.has(i.id))}
                onUpdate={handleUpdateItems}
                constructionType={project.construction_type}
                filterStep={filterStep}
                filterFactorType={filterFactorType}
                filterFactorDetail={filterFactorDetail}
                mode={viewMode === 'list' ? 'selection' : 'edit'}
                selectedIds={selectedIds}
                onToggleSelection={(id, selected) => {
                    const newSet = new Set(selectedIds);
                    if (selected) newSet.add(id);
                    else newSet.delete(id);
                    setSelectedIds(newSet);
                }}
            />
        </div>
    );
}

export default RiskAssessmentEditor;
