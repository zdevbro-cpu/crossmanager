import './Page.css'
import { useState, useEffect } from 'react'
import { useContracts } from '../hooks/useContracts'
import { useProjects } from '../hooks/useProjects'
import type { Contract, ContractItem } from '../types/pms'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import { Trash2, Plus, Pencil, X, Check, CheckSquare, Printer, Paperclip, FileText } from 'lucide-react'
import { useRole } from '../hooks/useRole'
import { apiClient } from '../lib/api'

// Standard Regulation Templates
const REGULATION_TEMPLATES: Record<string, string[]> = {
  '삼성': ['안전 서약서', '보안 각서', 'ISO 45001 인증서', '작업허가서(PTW)', '위험성평가표', 'MSDS 자료'],
  'LG': ['업체 등록증', '비밀유지계약서(NDA)', '안전관리계획서', '특수건강검진 확인서', '근로자 명부'],
  'SK': ['SHEQ 규정 준수 서약서', '화학물질 취급 승인서', '비상대응 매뉴얼', '입문 교육 이수증'],
  '현대자동차': ['안전작업 허가서', '설비 반입 신청서', '유해화학물질 관리 대장'],
  '포스코': ['표준작업준수 서약서', '밀폐공간 작업 허가서', '일일 안전 점검표'],
  '한화': ['안전 환경 서약서', '작업 계획서', '장비 점검표'],
  '기타': ['계약서 사본', '사업자등록증', '통장사본']
}

// Helper to create checklist items
const createChecklist = (names: string[]) => {
  return names.map(name => ({
    id: Math.random().toString(36).substring(2, 9),
    label: name,
    checked: false
  }))
}

function ContractsPage() {
  const { selectedId } = useProjectContext()
  const { show } = useToast()
  const { data: contracts, isLoading, createContract, updateContract, deleteContract } = useContracts(selectedId || undefined)
  const { data: projects } = useProjects() // Fetch real projects

  const [editingId, setEditingId] = useState<string | null>(null)

  const openBlobUrl = (base64Url: string) => {
    try {
      const parts = base64Url.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Blob conversion failed', e);
      return base64Url;
    }
  }
  const { role } = useRole()
  const canEditContracts = role !== 'field'

  // Form State
  const [form, setForm] = useState<Partial<Contract>>({
    type: 'CONTRACT',
    category: 'NEW',
    status: 'DRAFT',
    regulationConfig: { name: '' },
    indirectRate: 15,
    riskRate: 10,
    marginRate: 15,
    items: []
  })



  // UI State for Items
  const [items, setItems] = useState<ContractItem[]>(Array(5).fill(null).map(() => ({ group: '', name: '', spec: '', quantity: 0, unit: '식', unitPrice: 0, amount: 0 })))

  // Sync Regulation with Project
  // Sync Regulation with Project
  useEffect(() => {
    if (form.projectId && !editingId && projects) {
      const project = projects.find(p => p.id === form.projectId)
      if (project && project.regulation) {
        const regName = project.regulation
        let requirements: any[] = []

        // Check if we have a template
        if (REGULATION_TEMPLATES[regName]) {
          requirements = createChecklist(REGULATION_TEMPLATES[regName])
        } else {
          // Try partial match
          const match = Object.keys(REGULATION_TEMPLATES).find(key => regName.includes(key))
          if (match) {
            requirements = createChecklist(REGULATION_TEMPLATES[match])
          } else {
          }
        }

        setForm(prev => ({
          ...prev,
          regulationConfig: {
            name: regName,
            requirements: requirements
          }
        }))
      }
    }
  }, [form.projectId, editingId, projects])

  const handleChecklistToggle = (itemId: string) => {
    setForm(prev => {
      const newReqs = prev.regulationConfig?.requirements?.map(item =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      ) || []
      return { ...prev, regulationConfig: { ...prev.regulationConfig!, requirements: newReqs } }
    })
  }

  const handleAddChecklistItem = () => {
    const name = prompt('추가할 서류/항목명을 입력하세요:')
    if (name) {
      const newItem = { id: Math.random().toString(36).substring(2, 9), label: name, checked: false }
      setForm(prev => ({
        ...prev,
        regulationConfig: {
          ...prev.regulationConfig!,
          requirements: [...(prev.regulationConfig?.requirements || []), newItem]
        }
      }))
    }
  }

  const handleRemoveChecklistItem = (itemId: string) => {
    setForm(prev => ({
      ...prev,
      regulationConfig: {
        ...prev.regulationConfig!,
        requirements: prev.regulationConfig?.requirements?.filter(r => r.id !== itemId) || []
      }
    }))
  }

  const handleEdit = async (contract: Contract) => {
    try {
      const { data } = await apiClient.get<any>(`/contracts/${contract.id}`) // Use any to handle backend fields
      setEditingId(data.id)

      // Map backend fields to frontend
      setForm({
        ...data,
        indirectRate: data.indirectRate || data.indirect_rate || 15,
        riskRate: data.riskRate || data.risk_rate || 10,
        marginRate: data.marginRate || data.margin_rate || 15,
        regulationConfig: data.regulationConfig || data.regulation_config,
        projectId: data.projectId || data.project_id
      })

      const backendItems = data.items || []
      const mappedItems = backendItems.map((i: any) => ({
        ...i,
        group: i.group || i.group_name || '',
        unitPrice: i.unitPrice || i.unit_price || 0,
        amount: i.amount || 0
      }))

      const paddedItems = [...mappedItems]
      while (paddedItems.length < 5) {
        paddedItems.push({ group: '', name: '', spec: '', quantity: 0, unit: '식', unitPrice: 0, amount: 0 })
      }
      setItems(paddedItems)
    } catch (err) {
      console.error(err)
      show('계약 상세 정보를 불러오는데 실패했습니다.', 'error')
    }
  }

  const handleReset = () => {
    setEditingId(null)
    setForm({
      projectId: selectedId || '',
      type: 'CONTRACT',
      category: 'NEW',
      status: 'DRAFT',
      regulationConfig: { name: '' },
      indirectRate: 15,
      riskRate: 10,
      marginRate: 15,
      totalAmount: 0, costDirect: 0, costIndirect: 0, riskFee: 0, margin: 0
    })
    setItems(Array(5).fill(null).map(() => ({ group: '', name: '', spec: '', quantity: 0, unit: '식', unitPrice: 0, amount: 0 })))

  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.projectId) {
      show('프로젝트를 선택해주세요.', 'warning')
      return
    }

    try {
      // Filter empty items
      const validItems = items.filter(i => i.name && i.name.trim() !== '')

      const payload = {
        ...form,
        items: validItems
      }

      if (editingId) {
        await updateContract({ ...payload, id: editingId } as Contract)
        show('수정되었습니다.', 'success')
      } else {
        await createContract(payload as Contract)
        show('생성되었습니다.', 'success')
      }
      handleReset()
    } catch (err: any) {
      console.error(err)
      const msg = err.response?.data?.details || err.response?.data?.error || err.message || '저장에 실패했습니다.'
      show(`저장 실패: ${msg}`, 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await deleteContract(id)
      show('삭제되었습니다.', 'success')
      if (editingId === id) handleReset()
    } catch (err) {
      show('삭제 실패.', 'error')
    }
  }

  const handleFileChange = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx,.jpg,.png'
    input.onchange = (e: any) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (readerEvent) => {
          const base64 = readerEvent.target?.result as string
          setForm(prev => ({
            ...prev,
            attachment: {
              name: file.name,
              url: base64, // Persist base64
              size: file.size
            }
          }))
          show('파일이 첨부되었습니다.', 'success')
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
  }

  const handlePrint = async (c: Contract) => {
    // If details missing (e.g. called from list), fetch first
    let contractToPrint = c
    if (!c.items || c.items.length === 0) {
      try {
        const { data } = await apiClient.get<Contract>(`/contracts/${c.id}`)
        contractToPrint = data
      } catch {
        // ignore, try printing what we have
      }
    }

    if (contractToPrint.type === 'EST' && !contractToPrint.attachment?.url) {
      // Generate Estimate HTML
      const win = window.open('', '_blank')
      if (win) {
        const html = `
            <html>
            <head>
                <title>견적서 - ${contractToPrint.name}</title>
                <style>
                    body { font-family: sans-serif; padding: 2rem; }
                    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 1rem; }
                    .info { margin-bottom: 2rem; }
                    .info p { margin: 0.5rem 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 2rem; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .total { text-align: right; font-size: 1.2rem; font-weight: bold; margin-top: 2rem; }
                </style>
            </head>
            <body>
                <h1>견 적 서</h1>
                <div class="info">
                    <p><strong>프로젝트:</strong> ${projects?.find(p => p.id === contractToPrint.projectId)?.name || contractToPrint.projectId}</p>
                    <p><strong>계약명:</strong> ${contractToPrint.name}</p>
                    <p><strong>일자:</strong> ${contractToPrint.contractDate || new Date().toLocaleDateString()}</p>
                    <p><strong>수신:</strong> 고객사 귀하</p>
                </div>

                <h3>공사 범위 및 내역</h3>
                <table>
                    <thead>
                        <tr>
                            <th>공종</th><th>품명</th><th>규격</th><th>수량</th><th>단위</th><th>단가</th><th>금액</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(contractToPrint.items || []).map((item: any) => `
                            <tr>
                                <td>${item.group || item.group_name || ''}</td>
                                <td>${item.name}</td>
                                <td>${item.spec || ''}</td>
                                <td>${item.quantity}</td>
                                <td>${item.unit}</td>
                                <td>${(item.unitPrice || item.unit_price || 0).toLocaleString()}</td>
                                <td>${(item.amount || 0).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="total">
                    총 견적 금액: ${(contractToPrint.totalAmount || 0).toLocaleString()} 원
                </div>
            </body>
            </html>
          `
        win.document.write(html)
        win.document.close()
        win.print()
      }
    } else {
      // Contract or Attachment Exists
      if (contractToPrint.attachment?.url) {
        const blobUrl = openBlobUrl(contractToPrint.attachment.url)
        const win = window.open()
        if (win) {
          win.document.write(`
            <html><body style="margin:0">
              <iframe id="pdfFrame" src="${blobUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>
              <script>
                document.getElementById('pdfFrame').onload = function() {
                  setTimeout(function() {
                    try {
                      document.getElementById('pdfFrame').contentWindow.print();
                    } catch(e) { console.error('Auto-print error:', e); }
                  }, 500);
                };
              </script>
            </body></html>
          `)
          win.document.close()
        }
      } else if (contractToPrint.attachment?.name) {
        show(`파일을 찾을 수 없습니다: ${contractToPrint.attachment.name}`, 'error')
      } else {
        show('첨부된 계약서 파일이 없습니다.', 'warning')
      }
    }
  }

  const addItem = () => {
    setItems(prev => [...prev, { group: '', name: '', spec: '', quantity: 0, unit: '식', unitPrice: 0, amount: 0 }])
  }

  // Auto-calculate totals whenever items or rates change
  useEffect(() => {
    const sumDirect = items.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

    const iRate = Number(form.indirectRate) || 0
    const rRate = Number(form.riskRate) || 0
    const mRate = Number(form.marginRate) || 0

    const indirect = Math.round(sumDirect * (iRate / 100))
    const risk = Math.round(sumDirect * (rRate / 100))
    const margin = Math.round(sumDirect * (mRate / 100))
    const total = sumDirect + indirect + risk + margin

    if (
      Number(form.costDirect) !== sumDirect ||
      Number(form.costIndirect) !== indirect ||
      Number(form.riskFee) !== risk ||
      Number(form.margin) !== margin ||
      Number(form.totalAmount) !== total
    ) {
      setForm(prev => ({
        ...prev,
        costDirect: sumDirect,
        costIndirect: indirect,
        riskFee: risk,
        margin: margin,
        totalAmount: total
      }))
    }
  }, [items, form.indirectRate, form.riskRate, form.marginRate, form.costDirect, form.costIndirect, form.riskFee, form.margin, form.totalAmount])



  const updateItem = (index: number, field: keyof ContractItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    // Auto calc amount
    if (field === 'quantity' || field === 'unitPrice') {
      const q = Number(field === 'quantity' ? value : newItems[index].quantity) || 0
      const p = Number(field === 'unitPrice' ? value : newItems[index].unitPrice) || 0
      newItems[index].amount = Math.round(q * p);
    }
    setItems(newItems)

    // Recalculate Totals
    const sumDirect = newItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

    setForm(prev => {
      const iRate = Number(prev.indirectRate) || 0
      const rRate = Number(prev.riskRate) || 0
      const mRate = Number(prev.marginRate) || 0

      const indirect = Math.round(sumDirect * (iRate / 100))
      const risk = Math.round(sumDirect * (rRate / 100))
      const margin = Math.round(sumDirect * (mRate / 100))

      return {
        ...prev,
        costDirect: sumDirect,
        costIndirect: indirect,
        riskFee: risk,
        margin: margin,
        totalAmount: sumDirect + indirect + risk + margin
      }
    })
  }

  const handleRateChange = (type: 'indirect' | 'risk' | 'margin', rate: number) => {
    // Update rate and recalc amount
    const direct = form.costDirect || 0
    const val = Math.round(direct * (rate / 100))

    setForm(prev => {
      const next = { ...prev, [`${type}Rate`]: rate }

      let i = next.costIndirect || 0
      let r = next.riskFee || 0
      let m = next.margin || 0

      if (type === 'indirect') i = val
      if (type === 'risk') r = val
      if (type === 'margin') m = val

      const tot = direct + i + r + m
      return {
        ...next,
        costIndirect: i,
        riskFee: r,
        margin: m,
        totalAmount: tot
      }
    })
  }

  const handleChecklistFile = (itemId: string) => { // Mock upload
    // In real app, trigger hidden file input
    const confirmUpload = confirm('파일을 선택하시겠습니까? (Mock)')
    if (confirmUpload) {
      setForm(prev => {
        const newReqs = prev.regulationConfig?.requirements?.map(item =>
          item.id === itemId ? { ...item, file: { name: 'sample_doc.pdf', url: '#', size: 1024 } } : item
        ) || []
        return { ...prev, regulationConfig: { ...prev.regulationConfig!, requirements: newReqs } }
      })
    }
  }

  const handleBatchPrint = () => {
    const files = form.regulationConfig?.requirements?.filter(r => r.file).length || 0
    if (files === 0) {
      show('첨부된 파일이 없습니다.', 'warning')
      return
    }
    show(`${files}개 문서를 일괄 출력(다운로드)합니다.`, 'success')
  }

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
  }

  return (
    <div className="page">
      <header className="section-header">
        <div>
          <p className="eyebrow">계약 · 견적 · 변경계약</p>
          <h2>종합 계약/견적 관리</h2>
          <p className="muted">
            고객사 규정(Samsung/LG 등)을 반영한 견적 및 계약 내역을 관리합니다. (SOW, 리스크, 비용 산출)
          </p>
        </div>
      </header>

      {/* List Section */}
      <section className="card table-card">
        <div className="table-head">
          <span className="card-label">계약 목록</span>
          <button className="pill pill-outline" onClick={handleReset}>새 계약 작성</button>
        </div>
        {isLoading && <p className="muted p-4">로딩 중...</p>}
        <div className="table contracts-table" style={{ maxHeight: '400px', overflowY: 'auto', display: 'block' }}>
          <div className="table-row table-header" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#25262b' }}>
            <span>프로젝트</span>
            <span>구분</span>
            <span>계약명</span>
            <span>규정</span>
            <span>총액</span>
            <span>상태</span>
            <span>관리</span>
          </div>
          {contracts?.map(c => {
            const project = projects?.find(p => p.id === c.projectId)
            return (
              <div key={c.id} className="table-row" onClick={() => handleEdit(c)} style={{ cursor: 'pointer' }}>
                <span title={project?.name || c.projectId} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project?.name || c.projectId}
                </span>
                <span className="badge">{c.type === 'EST' ? '견적' : c.type === 'CONTRACT' ? '계약' : '변경'}</span>
                <span>{c.name}</span>
                <span>{c.regulationConfig?.name}</span>
                <span>{c.totalAmount.toLocaleString()} 원</span>
                <span className={`badge ${c.status === 'SIGNED' ? 'badge-live' : ''}`}>{c.status}</span>
                <span className="row-actions">
                  <button onClick={(e) => { e.stopPropagation(); handlePrint(c); }} className="icon-button" title="출력/보기"><Printer size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="icon-button"><Pencil size={16} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="icon-button"><Trash2 size={16} /></button>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Editor Section */}
      <section className="card">
        <div className="table-head">
          <p className="card-label">{editingId ? '계약 상세' : '새 계약 등록'}</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {editingId && (
              <button onClick={handleReset} className="icon-button" aria-label="취소" type="button">
                <X size={18} />
              </button>
            )}
            <button
              type="submit"
              form="contract-form"
              className="icon-button"
              disabled={!canEditContracts}
              aria-label={editingId ? '저장' : '생성'}
            >
              {editingId ? <Check size={18} /> : <Plus size={18} />}
            </button>
          </div>
        </div>

        <form id="contract-form" onSubmit={handleSave}>
          <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
            <label>
              <span>프로젝트</span>
              <select value={form.projectId || ''} onChange={e => setForm({ ...form, projectId: e.target.value })}>
                <option value="">선택</option>
                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>
              <span>구분</span>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}>
                <option value="EST">견적 (Estimate)</option>
                <option value="CONTRACT">계약 (Contract)</option>
                <option value="CHANGE">변경 (Change)</option>
              </select>
            </label>

            <label>
              <span>계약명</span>
              <input type="text" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="예: 평택 P3 1라인 철거 공사" required />
            </label>
            <label>
              <span>상태</span>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
                <option value="DRAFT">작성중</option>
                <option value="REVIEW">검토</option>
                <option value="SUBMITTED">제출</option>
                <option value="SIGNED">계약체결</option>
              </select>
            </label>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span>계약서/견적서 원본 첨부</span>
                <button type="button" onClick={handleFileChange} className="icon-button" style={{ padding: '2px' }} title="파일 첨부">
                  <Plus size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#25262b', padding: '0.6rem 0.8rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', minHeight: '40px' }}>
                {form.attachment ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <div
                      onClick={() => form.attachment?.url && window.open(openBlobUrl(form.attachment.url))}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}
                      title="파일 열기(다운로드)"
                    >
                      <Paperclip size={14} style={{ color: '#74c0fc' }} />
                      <span style={{ fontSize: '0.9rem', color: '#74c0fc', textDecoration: 'underline' }}>{form.attachment.name}</span>
                      {form.attachment.size && <span className="muted" style={{ fontSize: '0.8rem' }}>({Math.round(form.attachment.size / 1024)} KB)</span>}
                    </div>
                    <button type="button" onClick={() => setForm(p => ({ ...p, attachment: undefined }))} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', display: 'flex', marginLeft: 'auto' }} title="삭제">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: '0.85rem' }}>우측 + 버튼을 눌러 파일을 첨부하세요.</span>
                )}
              </div>
            </div>

            {/* Regulation - Full Width to prevent overlap */}
            <label style={{ gridColumn: 'span 2' }}>
              <span>고객사 규정 (프로젝트 설정 연동)</span>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select
                  style={{ width: '150px', flexShrink: 0 }}
                  value={['삼성', 'LG', 'SK', '현대자동차', '포스코', '한화', '한국전력공사', '인천국제공항공사', '기타'].includes(form.regulationConfig?.name || '') ? form.regulationConfig?.name : '직접입력'}
                  onChange={e => {
                    const val = e.target.value
                    if (val === '직접입력') {
                      setForm({ ...form, regulationConfig: { ...form.regulationConfig, name: '' } })
                    } else {
                      // Load Template
                      const newReqs = REGULATION_TEMPLATES[val] ? createChecklist(REGULATION_TEMPLATES[val]) : []
                      setForm({ ...form, regulationConfig: { name: val, requirements: newReqs } })
                    }
                  }}
                >
                  <option value="직접입력">직접입력</option>
                  <option value="삼성">삼성</option>
                  <option value="LG">LG</option>
                  <option value="SK">SK</option>
                  <option value="현대자동차">현대자동차</option>
                  <option value="포스코">포스코</option>
                  <option value="한화">한화</option>
                  <option value="한국전력공사">한국전력공사</option>
                  <option value="인천국제공항공사">인천국제공항공사</option>
                  <option value="기타">기타</option>
                </select>

                {/* Show input if '직접입력' or custom value */}
                {!['삼성', 'LG', 'SK', '현대자동차', '포스코', '한화', '한국전력공사', '인천국제공항공사', '기타'].includes(form.regulationConfig?.name || '') && (
                  <input
                    style={{ flex: 1 }}
                    type="text"
                    value={form.regulationConfig?.name || ''}
                    onChange={e => setForm({ ...form, regulationConfig: { ...form.regulationConfig, name: e.target.value } })}
                    placeholder="규정명 직접 입력"
                  />
                )}
              </div>

              {/* Checklist UI */}
              <div className="panel" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="card-label" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckSquare size={14} /> 필수 서류 및 점검 사항 (Checklist)
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={handleBatchPrint} className="pill pill-outline" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                      <Printer size={12} /> 일괄 출력
                    </button>
                    <button type="button" onClick={handleAddChecklistItem} className="pill pill-outline" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                      <Plus size={12} /> 항목 추가
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {form.regulationConfig?.requirements?.map(req => (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#25262b', padding: '0.4rem', borderRadius: '4px' }}>
                      <input
                        type="checkbox"
                        checked={req.checked}
                        onChange={() => handleChecklistToggle(req.id)}
                      />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.85rem', display: 'block', textDecoration: req.checked ? 'line-through' : 'none', color: req.checked ? '#5c5f66' : 'inherit' }}>{req.label}</span>
                        {req.file && (
                          <span style={{ fontSize: '0.7rem', color: '#339af0', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <FileText size={10} /> {req.file.name}
                          </span>
                        )}
                      </div>
                      <button type="button" onClick={() => handleChecklistFile(req.id)} style={{ background: 'none', border: 'none', color: '#868e96', cursor: 'pointer', padding: 0, marginRight: '4px' }} title="파일 첨부">
                        <Paperclip size={14} />
                      </button>
                      <button type="button" onClick={() => handleRemoveChecklistItem(req.id)} style={{ background: 'none', border: 'none', color: '#868e96', cursor: 'pointer', padding: 0 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {(!form.regulationConfig?.requirements || form.regulationConfig.requirements.length === 0) && (
                    <p className="muted" style={{ fontSize: '0.8rem', gridColumn: 'span 2' }}>등록된 필수 항목이 없습니다.</p>
                  )}
                </div>
              </div>
            </label>
          </div>

          {/* Cost Summary - Styled to look like a sub-panel */}
          <div className="panel" style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.03)' }}>
            <p className="card-label" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>금액 산출 (Cost Summary)</p>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <label>
                <span className="muted" style={{ fontSize: '0.85rem' }}>직접비 (SOW 자동합계)</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={Math.round(Number(form.costDirect) || 0).toLocaleString()}
                    readOnly
                    style={{ fontWeight: 'bold', color: '#8bd3ff', textAlign: 'right', paddingRight: '2rem', width: '100%' }}
                  />
                  <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#868e96', fontSize: '0.8rem' }}>원</span>
                </div>
              </label>
              <label>
                <span className="muted" style={{ fontSize: '0.85rem' }}>간접비 (Rate/Amt)</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ position: 'relative', width: '70px' }}>
                    <input
                      type="text"
                      placeholder="0"
                      value={Math.round(Number(form.indirectRate) || 0)}
                      onChange={e => handleRateChange('indirect', Number(e.target.value.replace(/,/g, '')))}
                      style={{ width: '100%', textAlign: 'right', paddingRight: '1.5rem' }}
                    />
                    <span style={{ position: 'absolute', right: '0.3rem', top: '50%', transform: 'translateY(-50%)', color: '#868e96', fontSize: '0.8rem' }}>%</span>
                  </div>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      style={{ width: '100%', textAlign: 'right', paddingRight: '2rem' }}
                      value={Math.round(Number(form.costIndirect) || 0).toLocaleString()}
                      onChange={e => setForm(p => ({ ...p, costIndirect: Number(e.target.value.replace(/,/g, '')), totalAmount: (p.costDirect || 0) + Number(e.target.value.replace(/,/g, '')) + (p.riskFee || 0) + (p.margin || 0) }))}
                    />
                    <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#868e96', fontSize: '0.8rem' }}>원</span>
                  </div>
                </div>
              </label>
              <label>
                <span className="muted" style={{ fontSize: '0.85rem' }}>리스크비용 (Rate/Amt)</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ position: 'relative', width: '70px' }}>
                    <input
                      type="text"
                      placeholder="0"
                      value={Math.round(Number(form.riskRate) || 0)}
                      onChange={e => handleRateChange('risk', Number(e.target.value.replace(/,/g, '')))}
                      style={{ width: '100%', textAlign: 'right', paddingRight: '1.5rem' }}
                    />
                    <span style={{ position: 'absolute', right: '0.3rem', top: '50%', transform: 'translateY(-50%)', color: '#868e96', fontSize: '0.8rem' }}>%</span>
                  </div>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      style={{ width: '100%', textAlign: 'right', paddingRight: '2rem' }}
                      value={Math.round(Number(form.riskFee) || 0).toLocaleString()}
                      onChange={e => setForm(p => ({ ...p, riskFee: Number(e.target.value.replace(/,/g, '')), totalAmount: (p.costDirect || 0) + (p.costIndirect || 0) + Number(e.target.value.replace(/,/g, '')) + (p.margin || 0) }))}
                    />
                    <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#868e96', fontSize: '0.8rem' }}>원</span>
                  </div>
                </div>
              </label>
              <label>
                <span className="muted" style={{ fontSize: '0.85rem' }}>이익금 (Rate/Amt)</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ position: 'relative', width: '70px' }}>
                    <input
                      type="text"
                      placeholder="0"
                      value={Math.round(Number(form.marginRate) || 0)}
                      onChange={e => handleRateChange('margin', Number(e.target.value.replace(/,/g, '')))}
                      style={{ width: '100%', textAlign: 'right', paddingRight: '1.5rem' }}
                    />
                    <span style={{ position: 'absolute', right: '0.3rem', top: '50%', transform: 'translateY(-50%)', color: '#868e96', fontSize: '0.8rem' }}>%</span>
                  </div>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      style={{ width: '100%', textAlign: 'right', paddingRight: '2rem' }}
                      value={Math.round(Number(form.margin) || 0).toLocaleString()}
                      onChange={e => setForm(p => ({ ...p, margin: Number(e.target.value.replace(/,/g, '')), totalAmount: (p.costDirect || 0) + (p.costIndirect || 0) + (p.riskFee || 0) + Number(e.target.value.replace(/,/g, '')) }))}
                    />
                    <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#868e96', fontSize: '0.8rem' }}>원</span>
                  </div>
                </div>
              </label>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }}>
              <span className="muted" style={{ marginRight: '1rem' }}>총 견적 금액</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#8bd3ff' }}>{Math.round(Number(form.totalAmount) || 0).toLocaleString()} <span style={{ fontSize: '1rem' }}>원</span></span>
            </div>
          </div>

          {/* Items Grid */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="table-head">
              <p className="card-label">공사 범위 및 내역 (Scope of Work)</p>
              <button type="button" onClick={addItem} className="pill pill-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}><Plus size={14} /> 항목 추가</button>
            </div>
            <div className="table" style={{ fontSize: '0.9rem' }}>
              <div className="table-row table-header" style={{ gridTemplateColumns: '1fr 2fr 1.5fr 0.8fr 0.8fr 1fr 1fr 40px', alignItems: 'center' }}>
                <span>공종</span>
                <span>품명</span>
                <span>규격</span>
                <span style={{ textAlign: 'right' }}>수량</span>
                <span style={{ textAlign: 'center' }}>단위</span>
                <span style={{ textAlign: 'right' }}>단가</span>
                <span style={{ textAlign: 'right' }}>금액</span>
                <span></span>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="table-row" style={{ gridTemplateColumns: '1fr 2fr 1.5fr 0.8fr 0.8fr 1fr 1fr 40px', alignItems: 'center', padding: '0.5rem' }}>
                  <input className="compact-input" type="text" value={item.group} onChange={e => updateItem(idx, 'group', e.target.value)} placeholder="공종" />
                  <input className="compact-input" type="text" value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="품명" />
                  <input className="compact-input" type="text" value={item.spec} onChange={e => updateItem(idx, 'spec', e.target.value)} placeholder="규격" />
                  <input className="compact-input" type="text" value={Math.round(Number(item.quantity) || 0).toLocaleString()} onChange={e => updateItem(idx, 'quantity', Number(e.target.value.replace(/,/g, '')))} style={{ textAlign: 'right' }} />
                  <input className="compact-input" type="text" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} style={{ textAlign: 'center' }} />
                  <div style={{ position: 'relative' }}>
                    <input
                      className="compact-input"
                      type="text"
                      style={{ textAlign: 'right', paddingRight: '1.5rem', width: '100%' }}
                      value={Math.round(Number(item.unitPrice) || 0).toLocaleString()}
                      onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value.replace(/,/g, '')))}
                    />
                    <span style={{ position: 'absolute', right: '0.3rem', top: '50%', transform: 'translateY(-50%)', color: '#868e96', fontSize: '0.75rem' }}>원</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="compact-input"
                      type="text"
                      readOnly
                      style={{ textAlign: 'right', paddingRight: '1.5rem', width: '100%', fontWeight: 'bold', background: 'transparent', border: 'none', color: '#fff' }}
                      value={Math.round(Number(item.amount) || 0).toLocaleString()}
                    />
                    <span style={{ position: 'absolute', right: '0.3rem', top: '50%', transform: 'translateY(-50%)', color: '#868e96', fontSize: '0.75rem' }}>원</span>
                  </div>
                  <button type="button" onClick={() => removeItem(idx)} className="icon-button" style={{ width: '28px', height: '28px', color: '#ff6b6b' }}><X size={14} /></button>
                </div>
              ))}
              {items.length === 0 && <div className="p-4 text-center muted">항목이 없습니다. 우측 상단 버튼을 눌러 공사 내역을 추가해주세요.</div>}
            </div>
          </div>


        </form >
      </section >
    </div >
  )
}

export default ContractsPage
