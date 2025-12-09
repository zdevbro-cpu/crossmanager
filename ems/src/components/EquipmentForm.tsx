import { useState } from 'react'
import { useToast } from './ToastProvider'

interface EquipmentFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function EquipmentForm({ onSuccess, onCancel }: EquipmentFormProps) {
  const { show } = useToast()
  const [activeSection, setActiveSection] = useState(0)
  
  // Form state
  const [formData, setFormData] = useState({
    // Basic Info
    equipmentId: '',
    name: '',
    category: '',
    model: '',
    manufacturer: '',
    manufactureYear: '',
    specifications: '',
    serialNumber: '',
    acquisitionDate: '',
    equipmentStatus: '신품',
    
    // Purchase/Contract
    purchaseType: '구매',
    purchaseAmount: '',
    residualValue: '',
    depreciationMethod: '정액법',
    contractStartDate: '',
    contractEndDate: '',
    supplier: '',
    supplierContact: '',
    warrantyPeriod: '',
    
    // Registration & Legal
    registrationNumber: '',
    insuranceInfo: '',
    inspectionCycle: '',
    lastInspectionDate: '',
    nextInspectionDate: '',
    
    // Operations
    assignedSite: '',
    operatorName: '',
    primaryUse: '',
    operatingHours: '',
    usageRestrictions: '',
    
    // Maintenance
    maintenanceCycle: '',
    consumablesCycle: '',
    partsLifespan: '',
    serviceProvider: '',
    serviceContact: '',
    
    // Operating Data
    accumulatedHours: '',
    fuelConsumption: '',
    workPerformance: '',
    failureRecords: '',
    downtimeHours: '',
    
    // Cost Management
    fuelCost: '',
    maintenanceCost: '',
    insuranceCost: '',
    depreciationCost: '',
    rentalCost: '',
    totalCost: ''
  })

  const sections = [
    { id: 0, title: '기본 장비 정보', icon: '📋' },
    { id: 1, title: '구매·계약 정보', icon: '💰' },
    { id: 2, title: '등록 및 법정 확인', icon: '📜' },
    { id: 3, title: '운영 정보', icon: '⚙️' },
    { id: 4, title: '유지보수 설정', icon: '🔧' },
    { id: 5, title: '운영 데이터', icon: '📊' },
    { id: 6, title: '비용 관리', icon: '💵' }
  ]

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const res = await fetch('http://localhost:3000/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          type: '장비',
          ...formData
        })
      })
      
      if (res.ok) {
        show('장비가 성공적으로 등록되었습니다.', 'success')
        onSuccess()
      } else {
        const error = await res.json()
        show(`등록 실패: ${error.details || error.error}`, 'error')
      }
    } catch (err) {
      console.error(err)
      show('장비 등록 중 오류가 발생했습니다.', 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h3>장비 등록</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        {/* Section Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                padding: '0.5rem 1rem',
                background: activeSection === section.id ? '#3b82f6' : '#f1f5f9',
                color: activeSection === section.id ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: activeSection === section.id ? 600 : 400
              }}
            >
              {section.icon} {section.title}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '1.5rem' }}>
            
            {/* Section 0: Basic Equipment Info */}
            {activeSection === 0 && (
              <div className="form-grid">
                <label>
                  <span>장비 ID <span style={{ color: '#ef4444' }}>*</span></span>
                  <input 
                    className="input-std"
                    value={formData.equipmentId} 
                    onChange={(e) => handleChange('equipmentId', e.target.value)}
                    placeholder="예: EQ-2024-001"
                    required
                  />
                </label>
                <label>
                  <span>장비명 <span style={{ color: '#ef4444' }}>*</span></span>
                  <input 
                    className="input-std"
                    value={formData.name} 
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="예: 굴삭기 20톤"
                    required
                  />
                </label>
                <label>
                  <span>장비 종류</span>
                  <input 
                    className="input-std"
                    value={formData.category} 
                    onChange={(e) => handleChange('category', e.target.value)}
                    placeholder="예: 굴삭기, 지게차"
                  />
                </label>
                <label>
                  <span>모델명</span>
                  <input 
                    className="input-std"
                    value={formData.model} 
                    onChange={(e) => handleChange('model', e.target.value)}
                    placeholder="예: DX225LC"
                  />
                </label>
                <label>
                  <span>제조사</span>
                  <input 
                    className="input-std"
                    value={formData.manufacturer} 
                    onChange={(e) => handleChange('manufacturer', e.target.value)}
                    placeholder="예: 두산, 현대, CAT"
                  />
                </label>
                <label>
                  <span>제조연도</span>
                  <input 
                    className="input-std"
                    type="number"
                    value={formData.manufactureYear} 
                    onChange={(e) => handleChange('manufactureYear', e.target.value)}
                    placeholder="예: 2024"
                  />
                </label>
                <label>
                  <span>규격/톤수</span>
                  <input 
                    className="input-std"
                    value={formData.specifications} 
                    onChange={(e) => handleChange('specifications', e.target.value)}
                    placeholder="예: 20톤, 3.5톤"
                  />
                </label>
                <label>
                  <span>일련번호 (S/N)</span>
                  <input 
                    className="input-std"
                    value={formData.serialNumber} 
                    onChange={(e) => handleChange('serialNumber', e.target.value)}
                    placeholder="제조사 시리얼번호"
                  />
                </label>
                <label>
                  <span>도입일자</span>
                  <input 
                    className="input-std"
                    type="date"
                    value={formData.acquisitionDate} 
                    onChange={(e) => handleChange('acquisitionDate', e.target.value)}
                  />
                </label>
                <label>
                  <span>장비 상태</span>
                  <select 
                    className="input-std"
                    value={formData.equipmentStatus} 
                    onChange={(e) => handleChange('equipmentStatus', e.target.value)}
                  >
                    <option value="신품">신품</option>
                    <option value="중고">중고</option>
                    <option value="리빌트">리빌트</option>
                  </select>
                </label>
              </div>
            )}

            {/* Section 1: Purchase/Contract Info */}
            {activeSection === 1 && (
              <div className="form-grid">
                <label>
                  <span>구매 방식</span>
                  <select 
                    className="input-std"
                    value={formData.purchaseType} 
                    onChange={(e) => handleChange('purchaseType', e.target.value)}
                  >
                    <option value="구매">구매</option>
                    <option value="리스">리스</option>
                    <option value="렌탈">렌탈</option>
                  </select>
                </label>
                <label>
                  <span>계약금액 (원)</span>
                  <input 
                    className="input-std"
                    type="number"
                    value={formData.purchaseAmount} 
                    onChange={(e) => handleChange('purchaseAmount', e.target.value)}
                    placeholder="공급가 + 부가세"
                  />
                </label>
                <label>
                  <span>잔존가치 (원)</span>
                  <input 
                    className="input-std"
                    type="number"
                    value={formData.residualValue} 
                    onChange={(e) => handleChange('residualValue', e.target.value)}
                  />
                </label>
                <label>
                  <span>감가상각 방법</span>
                  <select 
                    className="input-std"
                    value={formData.depreciationMethod} 
                    onChange={(e) => handleChange('depreciationMethod', e.target.value)}
                  >
                    <option value="정액법">정액법</option>
                    <option value="정률법">정률법</option>
                  </select>
                </label>
                <label>
                  <span>계약 시작일</span>
                  <input 
                    className="input-std"
                    type="date"
                    value={formData.contractStartDate} 
                    onChange={(e) => handleChange('contractStartDate', e.target.value)}
                  />
                </label>
                <label>
                  <span>계약 종료일</span>
                  <input 
                    className="input-std"
                    type="date"
                    value={formData.contractEndDate} 
                    onChange={(e) => handleChange('contractEndDate', e.target.value)}
                  />
                </label>
                <label>
                  <span>공급업체</span>
                  <input 
                    className="input-std"
                    value={formData.supplier} 
                    onChange={(e) => handleChange('supplier', e.target.value)}
                  />
                </label>
                <label>
                  <span>공급업체 연락처</span>
                  <input 
                    className="input-std"
                    value={formData.supplierContact} 
                    onChange={(e) => handleChange('supplierContact', e.target.value)}
                    placeholder="010-0000-0000"
                  />
                </label>
                <label>
                  <span>보증기간</span>
                  <input 
                    className="input-std"
                    value={formData.warrantyPeriod} 
                    onChange={(e) => handleChange('warrantyPeriod', e.target.value)}
                    placeholder="예: 12개월"
                  />
                </label>
              </div>
            )}

            {/* Section 2: Registration & Legal */}
            {activeSection === 2 && (
              <div className="form-grid">
                <label>
                  <span>장비 등록번호</span>
                  <input 
                    className="input-std"
                    value={formData.registrationNumber} 
                    onChange={(e) => handleChange('registrationNumber', e.target.value)}
                    placeholder="건설기계등록증 번호"
                  />
                </label>
                <label>
                  <span>보험 가입정보</span>
                  <textarea 
                    className="input-std"
                    value={formData.insuranceInfo} 
                    onChange={(e) => handleChange('insuranceInfo', e.target.value)}
                    placeholder="보험사, 증권번호 등"
                    rows={3}
                  />
                </label>
                <label>
                  <span>검사 주기</span>
                  <input 
                    className="input-std"
                    value={formData.inspectionCycle} 
                    onChange={(e) => handleChange('inspectionCycle', e.target.value)}
                    placeholder="예: 6개월, 1년"
                  />
                </label>
                <label>
                  <span>최근 검사일</span>
                  <input 
                    className="input-std"
                    type="date"
                    value={formData.lastInspectionDate} 
                    onChange={(e) => handleChange('lastInspectionDate', e.target.value)}
                  />
                </label>
                <label>
                  <span>다음 검사일</span>
                  <input 
                    className="input-std"
                    type="date"
                    value={formData.nextInspectionDate} 
                    onChange={(e) => handleChange('nextInspectionDate', e.target.value)}
                  />
                </label>
              </div>
            )}

            {/* Section 3: Operations */}
            {activeSection === 3 && (
              <div className="form-grid">
                <label>
                  <span>배치 현장</span>
                  <input 
                    className="input-std"
                    value={formData.assignedSite} 
                    onChange={(e) => handleChange('assignedSite', e.target.value)}
                    placeholder="투입 현장명"
                  />
                </label>
                <label>
                  <span>담당자/기사</span>
                  <input 
                    className="input-std"
                    value={formData.operatorName} 
                    onChange={(e) => handleChange('operatorName', e.target.value)}
                  />
                </label>
                <label>
                  <span>주요 용도</span>
                  <input 
                    className="input-std"
                    value={formData.primaryUse} 
                    onChange={(e) => handleChange('primaryUse', e.target.value)}
                    placeholder="예: 굴착, 상차, 운반"
                  />
                </label>
                <label>
                  <span>운영 시간대</span>
                  <input 
                    className="input-std"
                    value={formData.operatingHours} 
                    onChange={(e) => handleChange('operatingHours', e.target.value)}
                    placeholder="예: 08:00-18:00"
                  />
                </label>
                <label>
                  <span>운행 제한조건</span>
                  <textarea 
                    className="input-std"
                    value={formData.usageRestrictions} 
                    onChange={(e) => handleChange('usageRestrictions', e.target.value)}
                    placeholder="적재, 주행, 고도 등 제한사항"
                    rows={3}
                  />
                </label>
              </div>
            )}

            {/* Section 4: Maintenance */}
            {activeSection === 4 && (
              <div className="form-grid">
                <label>
                  <span>기본 점검 주기</span>
                  <input 
                    className="input-std"
                    value={formData.maintenanceCycle} 
                    onChange={(e) => handleChange('maintenanceCycle', e.target.value)}
                    placeholder="예: 250hr, 500hr, 1000hr"
                  />
                </label>
                <label>
                  <span>소모품 교환 주기</span>
                  <input 
                    className="input-std"
                    value={formData.consumablesCycle} 
                    onChange={(e) => handleChange('consumablesCycle', e.target.value)}
                    placeholder="엔진오일, 필터류 등"
                  />
                </label>
                <label>
                  <span>주요 부품 수명</span>
                  <textarea 
                    className="input-std"
                    value={formData.partsLifespan} 
                    onChange={(e) => handleChange('partsLifespan', e.target.value)}
                    placeholder="트랙, 타이어, 배터리 등"
                    rows={3}
                  />
                </label>
                <label>
                  <span>정비 업체</span>
                  <input 
                    className="input-std"
                    value={formData.serviceProvider} 
                    onChange={(e) => handleChange('serviceProvider', e.target.value)}
                  />
                </label>
                <label>
                  <span>정비 업체 연락처</span>
                  <input 
                    className="input-std"
                    value={formData.serviceContact} 
                    onChange={(e) => handleChange('serviceContact', e.target.value)}
                    placeholder="010-0000-0000"
                  />
                </label>
              </div>
            )}

            {/* Section 5: Operating Data */}
            {activeSection === 5 && (
              <div className="form-grid">
                <label>
                  <span>누적 운행시간 (HR)</span>
                  <input 
                    className="input-std"
                    type="number"
                    step="0.01"
                    value={formData.accumulatedHours} 
                    onChange={(e) => handleChange('accumulatedHours', e.target.value)}
                  />
                </label>
                <label>
                  <span>유류 사용량 (L)</span>
                  <input 
                    className="input-std"
                    type="number"
                    step="0.01"
                    value={formData.fuelConsumption} 
                    onChange={(e) => handleChange('fuelConsumption', e.target.value)}
                  />
                </label>
                <label>
                  <span>작업 실적</span>
                  <textarea 
                    className="input-std"
                    value={formData.workPerformance} 
                    onChange={(e) => handleChange('workPerformance', e.target.value)}
                    placeholder="m³, 톤수, 횟수 등"
                    rows={3}
                  />
                </label>
                <label>
                  <span>고장 기록</span>
                  <textarea 
                    className="input-std"
                    value={formData.failureRecords} 
                    onChange={(e) => handleChange('failureRecords', e.target.value)}
                    placeholder="고장코드, 발생시간 등"
                    rows={3}
                  />
                </label>
                <label>
                  <span>다운타임 (시간)</span>
                  <input 
                    className="input-std"
                    type="number"
                    step="0.01"
                    value={formData.downtimeHours} 
                    onChange={(e) => handleChange('downtimeHours', e.target.value)}
                  />
                </label>
              </div>
            )}

            {/* Section 6: Cost Management */}
            {activeSection === 6 && (
              <div className="form-grid">
                <label>
                  <span>유류비 (원)</span>
                  <input 
                    className="input-std"
                    type="number"
                    value={formData.fuelCost} 
                    onChange={(e) => handleChange('fuelCost', e.target.value)}
                  />
                </label>
                <label>
                  <span>정비비 (원)</span>
                  <input 
                    className="input-std"
                    type="number"
                    value={formData.maintenanceCost} 
                    onChange={(e) => handleChange('maintenanceCost', e.target.value)}
                  />
                </label>
                <label>
                  <span>보험료 (원)</span>
                  <input 
                    className="input-std"
                    type="number"
                    value={formData.insuranceCost} 
                    onChange={(e) => handleChange('insuranceCost', e.target.value)}
                  />
                </label>
                <label>
                  <span>감가상각비 (원)</span>
                  <input 
                    className="input-std"
                    type="number"
                    value={formData.depreciationCost} 
                    onChange={(e) => handleChange('depreciationCost', e.target.value)}
                  />
                </label>
                <label>
                  <span>리스/렌탈비 (원)</span>
                  <input 
                    className="input-std"
                    type="number"
                    value={formData.rentalCost} 
                    onChange={(e) => handleChange('rentalCost', e.target.value)}
                  />
                </label>
                <label>
                  <span>총 보유비용 (원)</span>
                  <input 
                    className="input-std"
                    type="number"
                    value={formData.totalCost} 
                    onChange={(e) => handleChange('totalCost', e.target.value)}
                    placeholder="자동 계산 또는 수동 입력"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {activeSection > 0 && (
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveSection(prev => prev - 1)}
                >
                  ← 이전
                </button>
              )}
              {activeSection < sections.length - 1 && (
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveSection(prev => prev + 1)}
                >
                  다음 →
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={onCancel}>
                취소
              </button>
              <button type="submit" className="btn-primary">
                등록
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
