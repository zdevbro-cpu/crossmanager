import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTasks, useTaskMutations } from '../hooks/useTasks'
import { useProjectContext } from '../context/ProjectContext'
import { useToast } from '../components/ToastProvider'
import type { Task } from '../types/pms'
import { ChevronRight, ChevronDown, Plus, ZoomIn, ZoomOut, Save, CornerDownRight, Trash2, Edit2, Download } from 'lucide-react'
import './Page.css'
import './Gantt.css'

const PX_PER_DAY_DEFAULT = 40
const ROW_HEIGHT = 40

function parseDate(value: string) {
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

type FlattenedTask = Task & {
  depth: number
  isExpanded: boolean
  hasChildren: boolean
  wbsNumber: string
  index: number
  isVisible: boolean
}

export default function Schedule() {
  const { data: rawTasks = [] } = useTasks()
  const { createMutation, updateMutation, deleteMutation, clearTasksMutation } = useTaskMutations()
  const { show } = useToast()
  const { selectedId } = useProjectContext()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())

  // View Settings
  const [pxPerDay, setPxPerDay] = useState(PX_PER_DAY_DEFAULT)

  // Drag & Drop
  const [draggedTasks, setDraggedTasks] = useState<Record<string, { start: string, end: string }>>({})

  // Right Click Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, taskId: string } | null>(null)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create-root' | 'create-sub' | 'edit'>('create-root')
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const [form, setForm] = useState({
    name: '',
    start: '',
    end: '',
    progress: 0,
    predecessorsWbs: '',
    parentId: '',
  })

  // Refs
  const wbsRef = useRef<HTMLDivElement>(null)
  const wbsInnerRef = useRef<HTMLDivElement>(null)
  const ganttBodyRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const isSyncingScrollRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)

  // State: Drag
  const [draggingTask, setDraggingTask] = useState<{
    id: string
    mode: 'move' | 'resize'
    startX: number
    currentX: number
    currentY: number
    originalStart: number
    originalEnd: number
  } | null>(null)

  const currentDragRef = useRef(draggingTask)
  useEffect(() => {
    currentDragRef.current = draggingTask
  }, [draggingTask])

  const handleWheelSync = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!ganttBodyRef.current) return
    const next = Math.max(
      0,
      Math.min(ganttBodyRef.current.scrollTop + e.deltaY, ganttBodyRef.current.scrollHeight - ganttBodyRef.current.clientHeight),
    )
    ganttBodyRef.current.scrollTop = next
    if (wbsInnerRef.current) {
      wbsInnerRef.current.style.transform = `translateY(-${next}px)`
    }
    e.preventDefault()
  }

  // 1. Calculate minDate (Start of Week - Monday)
  const minDate = useMemo(() => {
    let baseTime: number
    if (rawTasks.length === 0) {
      baseTime = new Date().setHours(0, 0, 0, 0)
    } else {
      baseTime = Math.min(...rawTasks.map((t) => parseDate(t.start) || Date.now()))
    }
    const d = new Date(baseTime)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Align to Monday
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [rawTasks])

  // 2. Calculate totalDays
  const totalDays = useMemo(() => {
    if (rawTasks.length === 0) return 30
    const max = Math.max(...rawTasks.map((t) => parseDate(t.end) || Date.now()))
    return Math.ceil((max - minDate) / (1000 * 60 * 60 * 24)) + 30 // Padding
  }, [rawTasks, minDate])

  const todayOffset = ((Date.now() - minDate) / (1000 * 60 * 60 * 24)) * pxPerDay

  // Auto-expand on load
  useEffect(() => {
    if (rawTasks.length > 0 && expanded.size === 0) {
      const allIds = new Set(rawTasks.map((t) => t.id))
      setExpanded(allIds)
    }
  }, [rawTasks, expanded])

  // Sync Scroll Refs
  const syncScrollPositions = (source: 'wbs' | 'gantt', top: number, left?: number) => {
    if (!ganttBodyRef.current) return
    if (isSyncingScrollRef.current) return

    isSyncingScrollRef.current = true

    if (source === 'gantt') {
      if (wbsInnerRef.current) {
        wbsInnerRef.current.style.transform = `translateY(-${top}px)`
      }
    }

    if (headerRef.current && left !== undefined && Math.abs(headerRef.current.scrollLeft - left) > 1) {
      headerRef.current.scrollLeft = left
    }

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false
    })
  }

  const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
    syncScrollPositions('gantt', e.currentTarget.scrollTop, e.currentTarget.scrollLeft)
  }

  const handleHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!ganttBodyRef.current) return
    const left = e.currentTarget.scrollLeft
    if (Math.abs(ganttBodyRef.current.scrollLeft - left) > 1) {
      ganttBodyRef.current.scrollLeft = left
    }
  }

  // Helper: Close Context Menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  // 3. Flatten Tasks for WBS
  const flattened = useMemo(() => {
    const filtered = rawTasks.filter((t) => !selectedId || !t.projectId || t.projectId === selectedId)

    const byParent = new Map<string | undefined, Task[]>()
    filtered.forEach((t) => {
      const k = t.parentId || undefined // normalize
      if (!byParent.has(k)) byParent.set(k, [])
      byParent.get(k)!.push(t)
    })

    // Sort valid children by order
    byParent.forEach((list) => list.sort((a, b) => (a.order || 0) - (b.order || 0)))

    const result: FlattenedTask[] = []

    const traverse = (parentId: string | undefined, depth: number, wbsPrefix: string) => {
      const children = byParent.get(parentId) || []
      children.forEach((node, index) => {
        const currentWbs = wbsPrefix ? `${wbsPrefix}.${index + 1}` : `${index + 1}`
        const isExpanded = expanded.has(node.id)

        result.push({
          ...node,
          depth,
          isExpanded,
          hasChildren: byParent.has(node.id),
          wbsNumber: currentWbs,
          index: result.length,
          isVisible: true,
        })

        if (isExpanded && byParent.has(node.id)) {
          traverse(node.id, depth + 1, currentWbs)
        }
      })
    }

    traverse(undefined, 0, '')
    return result
  }, [rawTasks, expanded, selectedId])

  // Helper to convert IDs to WBS numbers
  const idsToWbs = (ids: string[]) => {
    if (!ids) return ''
    return ids
      .map((id) => {
        const t = flattened.find((x) => x.id === id)
        return t ? t.wbsNumber : ''
      })
      .filter(Boolean)
      .join(', ')
  }

  const wbsToIds = (wbsStr: string) => {
    if (!wbsStr) return []
    const nums = wbsStr.split(',').map((s) => s.trim())
    return nums
      .map((n) => {
        const t = flattened.find((x) => x.wbsNumber === n)
        return t ? t.id : undefined
      })
      .filter((x): x is string => !!x)
  }

  // --- Handlers & Effects ---
  const toggleExpand = (id: string) => {
    const newSet = new Set(expanded)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpanded(newSet)
  }

  const handleRowClick = (id: string) => {
    const newSet = new Set<string>()
    newSet.add(id)
    setSelectedTaskIds(newSet)
  }

  const handleContextMenu = (e: React.MouseEvent, taskId: string) => {
    e.preventDefault()
    e.stopPropagation()
    handleRowClick(taskId)
    setContextMenu({ x: e.clientX, y: e.clientY, taskId })
  }

  // Drag Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!currentDragRef.current) return
      e.preventDefault()

      const { id, mode, startX, originalStart, originalEnd } = currentDragRef.current
      const diffX = e.clientX - startX
      const diffDays = Math.round(diffX / pxPerDay)

      setDraggingTask((prev) => (prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null))

      let newStartMs = originalStart
      let newEndMs = originalEnd

      if (mode === 'move') {
        newStartMs = originalStart + diffDays * 24 * 60 * 60 * 1000
        newEndMs = originalEnd + diffDays * 24 * 60 * 60 * 1000
      } else if (mode === 'resize') {
        newEndMs = originalEnd + diffDays * 24 * 60 * 60 * 1000
        if (newEndMs < newStartMs) newEndMs = newStartMs
      }

      const newStart = new Date(newStartMs).toISOString().slice(0, 10)
      const newEnd = new Date(newEndMs).toISOString().slice(0, 10)

      setDraggedTasks((prev) => ({
        ...prev,
        [id]: { start: newStart, end: newEnd },
      }))
    }

    const handleMouseUp = async (e: MouseEvent) => {
      if (!currentDragRef.current) return

      const { id, mode, startX } = currentDragRef.current
      const diffX = e.clientX - startX
      const diffDays = Math.round(diffX / pxPerDay)

      setDraggedTasks((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setDraggingTask(null)

      if (diffDays !== 0) {
        const task = rawTasks.find((t) => t.id === id)
        if (task) {
          try {
            const originalStart = parseDate(task.start) || Date.now()
            const originalEnd = parseDate(task.end) || Date.now()

            let newStartMs = originalStart
            let newEndMs = originalEnd

            if (mode === 'move') {
              newStartMs = originalStart + diffDays * 24 * 60 * 60 * 1000
              newEndMs = originalEnd + diffDays * 24 * 60 * 60 * 1000
            } else if (mode === 'resize') {
              newEndMs = originalEnd + diffDays * 24 * 60 * 60 * 1000
              if (newEndMs < newStartMs) newEndMs = newStartMs
            }

            const payload = {
              ...task,
              start: new Date(newStartMs).toISOString().slice(0, 10),
              end: new Date(newEndMs).toISOString().slice(0, 10),
            }

            await updateMutation.mutateAsync(payload)
            show('일정이 변경되었습니다.', 'success')
          } catch (err) {
            show('일정 변경 실패', 'error')
          }
        }
      }
    }

    if (draggingTask) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingTask, pxPerDay, rawTasks, updateMutation, show])

  const handleBarMouseDown = (e: React.MouseEvent, task: Task, width: number) => {
    e.stopPropagation()
    const s = parseDate(task.start)
    const end = parseDate(task.end)
    if (!s || !end) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickXInBar = e.clientX - rect.left
    const isResize = width - clickXInBar < 15

    setDraggingTask({
      id: task.id,
      mode: isResize ? 'resize' : 'move',
      startX: e.clientX,
      currentX: e.clientX,
      currentY: e.clientY,
      originalStart: s,
      originalEnd: end,
    })
  }

  // Modals
  const openEditModal = (task: FlattenedTask) => {
    setModalMode('edit')
    setEditingTask(task)
    setForm({
      name: task.name,
      start: String(task.start).split('T')[0],
      end: String(task.end).split('T')[0],
      progress: task.progress,
      predecessorsWbs: idsToWbs(task.predecessors),
      parentId: task.parentId || '',
    })
    setIsModalOpen(true)
  }

  const openCreateRootModal = () => {
    setModalMode('create-root')
    setEditingTask(null)
    setForm({
      name: '',
      start: new Date().toISOString().slice(0, 10),
      end: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      progress: 0,
      predecessorsWbs: '',
      parentId: '',
    })
    setIsModalOpen(true)
  }

  const openCreateSubModal = (parentIdOverride?: string) => {
    const parentId = parentIdOverride || Array.from(selectedTaskIds)[0]
    if (!parentId) {
      show('상위 타스크를 먼저 선택해주세요.', 'warning')
      return
    }
    const parent = rawTasks.find((t) => t.id === parentId)
    setModalMode('create-sub')
    setEditingTask(null)
    setForm({
      name: '',
      start: parent ? String(parent.start).split('T')[0] : new Date().toISOString().slice(0, 10),
      end: parent ? String(parent.end).split('T')[0] : new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      progress: 0,
      predecessorsWbs: '',
      parentId: parentId,
    })
    setIsModalOpen(true)
  }

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.start || !form.end) {
      show('필수 항목을 입력하세요.', 'warning')
      return
    }

    const predIds = wbsToIds(form.predecessorsWbs)

    const newTaskPayload = {
      projectId: selectedId || undefined,
      name: form.name,
      start: form.start,
      end: form.end,
      progress: Number(form.progress),
      predecessors: predIds,
      parentId: form.parentId || undefined,
      order: editingTask ? editingTask.order : (rawTasks.length + 1) * 10,
    }

    try {
      if (modalMode === 'edit' && editingTask) {
        await updateMutation.mutateAsync({ ...editingTask, ...newTaskPayload })
        show('타스크가 수정되었습니다.', 'success')
      } else {
        const created = await createMutation.mutateAsync(newTaskPayload as any)
        if (created.parentId) setExpanded((prev) => new Set(prev).add(created.parentId!))
        show('타스크가 추가되었습니다.', 'success')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error(err)
      show('작업 저장 실패', 'error')
    }
  }

  const handleDeleteById = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await deleteMutation.mutateAsync(id)
      show('삭제되었습니다.', 'success')
      setContextMenu(null)
    } catch (err) {
      show('삭제 실패', 'error')
    }
  }

  // Import Logic
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedId) {
      show('프로젝트를 먼저 선택해주세요.', 'warning')
      e.target.value = ''
      return
    }

    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('기존 일정을 모두 삭제하고 MS Project 파일을 가져오시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      e.target.value = ''
      return
    }

    setIsImporting(true)

    // Clear existing tasks first
    try {
      await clearTasksMutation.mutateAsync()
    } catch (err) {
      console.error(err)
      show('기존 일정 삭제 중 오류가 발생했습니다.', 'error')
      setIsImporting(false)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target?.result as string
      try {
        const tasks = parseMSProjectXML(text, selectedId)
        if (tasks.length === 0) {
          show('가져올 작업이 없습니다.', 'warning')
          return
        }

        // Sequential Creation to avoid server overload (could be batched)
        let successCount = 0
        for (const task of tasks) {
          try {
            await createMutation.mutateAsync(task)
            successCount++
          } catch (err) {
            console.error('Failed to import task', task.name, err)
          }
        }
        show(`${successCount}개 작업 가져오기 완료`, 'success')
      } catch (err) {
        console.error(err)
        show('XML 파싱 또는 저장 중 오류가 발생했습니다.', 'error')
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        // Force refresh
        setExpanded(new Set())
      }
    }
    reader.readAsText(file)
  }

  const parseMSProjectXML = (xmlText: string, projectId: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'text/xml')
    const taskNodes = Array.from(doc.querySelectorAll('Task'))

    const uidToUuid = new Map<string, string>()
    const tempTasks: any[] = []

    // First Pass: Create Objects & Map UIDs
    taskNodes.forEach((node) => {
      const uid = node.querySelector('UID')?.textContent
      if (!uid) return

      const name = node.querySelector('Name')?.textContent || 'Untitled'
      // Skip if it looks like a project summary task (UID=0)
      if (uid === '0') return

      const uuid = crypto.randomUUID()
      uidToUuid.set(uid, uuid)

      const startText = node.querySelector('Start')?.textContent || ''
      const finishText = node.querySelector('Finish')?.textContent || ''
      const level = parseInt(node.querySelector('OutlineLevel')?.textContent || '0')
      const progress = parseInt(node.querySelector('PercentComplete')?.textContent || '0')

      // Predecessors
      const preds: string[] = []
      const predNodes = node.querySelectorAll('PredecessorLink > PredecessorUID')
      predNodes.forEach(p => {
        const pUid = p.textContent
        if (pUid) preds.push(pUid)
      })

      tempTasks.push({
        uuid,
        uid,
        name,
        start: startText.split('T')[0],
        end: finishText.split('T')[0],
        level,
        progress,
        predUids: preds
      })
    })

    // Second Pass: Resolve Parents & Predecessors
    const stack: { level: number; uuid: string }[] = []
    const finalTasks: any[] = []
    const orderStep = 10

    tempTasks.forEach((t, index) => {
      // 1. Parent
      while (stack.length > 0 && stack[stack.length - 1].level >= t.level) {
        stack.pop()
      }
      const parentId = stack.length > 0 ? stack[stack.length - 1].uuid : undefined
      stack.push({ level: t.level, uuid: t.uuid })

      // 2. Predecessors
      const predecessors = t.predUids
        .map((pUid: string) => uidToUuid.get(pUid))
        .filter((uuid: string | undefined) => !!uuid)

      // Fallback date
      const safeStart = t.start || new Date().toISOString().slice(0, 10)
      const safeEnd = t.end || new Date().toISOString().slice(0, 10)

      finalTasks.push({
        id: t.uuid,
        projectId,
        name: t.name,
        start: safeStart,
        end: safeEnd,
        progress: t.progress,
        parentId,
        predecessors,
        order: (index + 1) * orderStep
      })
    })

    return finalTasks
  }

  // Predecessor Smart Date
  useEffect(() => {
    if (form.predecessorsWbs && form.name) {
      const predIds = wbsToIds(form.predecessorsWbs)
      if (predIds.length > 0) {
        const lastPred = flattened.find((t) => t.id === predIds[predIds.length - 1])
        if (lastPred && lastPred.end) {
          const pEnd = new Date(lastPred.end)
          const newStart = new Date(pEnd.setDate(pEnd.getDate() + 1))
          const currentStart = new Date(form.start)
          const currentEnd = new Date(form.end)
          const duration = currentEnd.getTime() - currentStart.getTime()
          const nextEnd = new Date(newStart.getTime() + (duration > 0 ? duration : 86400000))

          setForm((prev) => ({
            ...prev,
            start: newStart.toISOString().slice(0, 10),
            end: nextEnd.toISOString().slice(0, 10),
          }))
        }
      }
    }
  }, [form.predecessorsWbs]) // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers for Render
  const getBarPos = (t: Task) => {
    const s = parseDate(t.start)
    const e = parseDate(t.end)
    if (!s || !e) return null

    const left = ((s - minDate) / (1000 * 60 * 60 * 24)) * pxPerDay
    const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1
    const width = days * pxPerDay

    return { left, width }
  }

  const renderDependencyLines = () => {
    return flattened.map((t) => {
      if (!t.predecessors || t.predecessors.length === 0) return null
      const endItem = flattened.find((x) => x.id === t.id)
      if (!endItem) return null
      const endPos = getBarPos(endItem)
      if (!endPos) return null

      const endY = endItem.index * ROW_HEIGHT + ROW_HEIGHT / 2
      const endX = endPos.left

      return t.predecessors.map((predId) => {
        const startItem = flattened.find((x) => x.id === predId)
        if (!startItem) return null
        const startPos = getBarPos(startItem)
        if (!startPos) return null

        const startY = startItem.index * ROW_HEIGHT + ROW_HEIGHT / 2
        const startX = startPos.left + startPos.width

        const points = `M ${startX} ${startY} L ${startX + 10} ${startY} L ${startX + 10} ${endY} L ${endX} ${endY}`

        return (
          <path
            key={`${t.id}-${predId}`}
            d={points}
            stroke="#64748b"
            strokeWidth="1.5"
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        )
      })
    })
  }

  const gridLines = []
  for (let i = 0; i < totalDays; i++) {
    const isWeekStart = i % 7 === 0
    gridLines.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: i * pxPerDay,
          top: 0,
          bottom: 0,
          borderRight: '1px dashed #334155',
          background: isWeekStart ? 'rgba(255,255,255,0.02)' : 'transparent',
          width: pxPerDay,
          pointerEvents: 'none',
        }}
      />,
    )
  }

  return (
    <div className="page" style={{ position: 'relative' }}>
      <header className="section-header" style={{ alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">공정(WBS)·일정</p>
          <h2>WBS & Gantt Chart</h2>
          <p className="muted">좌측 트리와 우측 차트가 연동되는 커스텀 간트 차트입니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '0.2rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <button className="icon-btn" title="축소" onClick={() => setPxPerDay((prev) => Math.max(10, prev - 5))}>
              <ZoomOut size={16} />
            </button>
            <button className="icon-btn" title="확대" onClick={() => setPxPerDay((prev) => Math.min(100, prev + 5))}>
              <ZoomIn size={16} />
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xml"
            hidden
          />
          <button className="pill pill-outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Download size={14} style={{ marginRight: 4 }} /> {isImporting ? '가져오는 중...' : 'XML 가져오기'}
          </button>
          <button className="pill pill-outline" onClick={openCreateRootModal}>
            <Plus size={14} style={{ marginRight: 4 }} /> 새 작업 추가
          </button>
        </div>
      </header>

      <div className="gantt-container">
        <div className="gantt-wbs-pane">
          <div className="wbs-header">
            <div style={{ width: 80 }}>NO</div>
            <div>WBS Name</div>
          </div>
          <div
            className="wbs-content"
            ref={wbsRef}
            onWheelCapture={handleWheelSync}
            style={{ overflow: 'hidden' }}
          >
            <div ref={wbsInnerRef}>
              {flattened.map((t) => {
                const isSelected = selectedTaskIds.has(t.id)
                return (
                  <div
                    key={t.id}
                    className={`wbs-row ${isSelected ? 'row-active' : ''}`}
                    onClick={() => handleRowClick(t.id)}
                    onDoubleClick={() => openEditModal(t)}
                    onContextMenu={(e) => handleContextMenu(e, t.id)}
                    style={{ cursor: 'pointer', background: isSelected ? 'rgba(139, 211, 255, 0.1)' : undefined }}
                  >
                    <div
                      className="wbs-cell-id"
                      style={{ width: 80, paddingLeft: 10, textAlign: 'left', color: '#8bd3ff', fontSize: '0.85rem' }}
                    >
                      {t.wbsNumber}
                    </div>
                    <div className="wbs-cell-name" style={{ paddingLeft: t.depth * 15 }}>
                      {t.hasChildren ? (
                        <button
                          className="icon-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleExpand(t.id)
                          }}
                        >
                          {t.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : (
                        <span style={{ width: 14, display: 'inline-block' }} />
                      )}
                      {t.name}
                    </div>
                  </div>
                )
              })}
              <div style={{ height: flattened.length === 0 ? 200 : 0 }} />
            </div>
          </div>
        </div>

        <div className="gantt-chart-pane">

          <div className="timeline-header" ref={headerRef} onScroll={handleHeaderScroll}>
            <div style={{ position: 'relative', height: '100%', width: totalDays * pxPerDay }}>
              {Array.from({ length: Math.ceil(totalDays / 7) }).map((_, i) => (
                <div key={i} className="timeline-scale-cell" style={{ left: i * 7 * pxPerDay, width: 7 * pxPerDay }}>
                  {new Date(minDate + i * 7 * 1000 * 60 * 60 * 24).getMonth() + 1}/
                  {new Date(minDate + i * 7 * 1000 * 60 * 60 * 24).getDate()} (W{i + 1})
                </div>
              ))}
            </div>
          </div>

          <div className="gantt-body" ref={ganttBodyRef} onScroll={handleGanttScroll} onWheelCapture={handleWheelSync}>
            <div style={{ position: 'relative', height: flattened.length * ROW_HEIGHT, width: totalDays * pxPerDay }}>
              {gridLines}
              {todayOffset >= 0 && <div className="today-line" style={{ left: todayOffset }} />}

              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                  </marker>
                </defs>
                {renderDependencyLines()}
              </svg>

              {flattened.map((t, idx) => (
                <div
                  key={t.id}
                  className={`gantt-row-bg ${selectedTaskIds.has(t.id) ? 'row-active' : ''}`}
                  style={{ top: idx * ROW_HEIGHT, width: '100%', background: selectedTaskIds.has(t.id) ? 'rgba(139, 211, 255, 0.05)' : undefined }}
                />
              ))}

              {flattened.map((t, idx) => {
                const isDragged = draggedTasks[t.id]
                const currentT = isDragged ? { ...t, ...draggedTasks[t.id] } : t

                const pos = getBarPos(currentT)
                if (!pos) return null

                const s = parseDate(currentT.start)
                const e = parseDate(currentT.end)
                const duration = s && e ? Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1 : 0

                return (
                  <div
                    key={t.id}
                    className="gantt-bar-item"
                    onDoubleClick={() => openEditModal(t)}
                    onClick={() => handleRowClick(t.id)}
                    onContextMenu={(e) => handleContextMenu(e, t.id)}
                    onMouseDown={(e) => handleBarMouseDown(e, t, pos.width)}
                    style={{
                      top: idx * ROW_HEIGHT + 8,
                      left: pos.left,
                      width: pos.width,
                      background: t.hasChildren ? '#334155' : undefined,
                      border: t.hasChildren ? '1px solid #475569' : undefined,
                      cursor: t.hasChildren ? 'default' : 'ew-resize',
                      paddingRight: 10,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none', display: 'block', width: '100%' }}>
                      {t.name} ({duration}일)
                    </span>

                    {!t.hasChildren && (
                      <div className="gantt-resize-handle" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 10, cursor: 'col-resize', zIndex: 2 }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {draggingTask && (
        <div
          style={{
            position: 'fixed',
            top: draggingTask.currentY - 40,
            left: draggingTask.currentX + 10,
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: '0.8rem',
            zIndex: 10000,
            pointerEvents: 'none',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: '#8bd3ff' }}>
              {draggingTask.mode === 'move' ? '이동' : '기간 조정'}
            </span>
            <span>
              {draggedTasks[draggingTask.id]?.start || new Date(draggingTask.originalStart).toISOString().slice(0, 10)}
              {' ~ '}
              {draggedTasks[draggingTask.id]?.end || new Date(draggingTask.originalEnd).toISOString().slice(0, 10)}
            </span>
            <span style={{ color: '#cbd5e1', opacity: 0.8 }}>
              (
              {
                Math.ceil(
                  (new Date(draggedTasks[draggingTask.id]?.end || draggingTask.originalEnd).getTime() -
                    new Date(draggedTasks[draggingTask.id]?.start || draggingTask.originalStart).getTime()) /
                  (1000 * 60 * 60 * 24),
                ) + 1
              }
              일)
            </span>
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="context-menu-item" onClick={() => openCreateSubModal(contextMenu.taskId)}>
            <CornerDownRight size={14} /> 하위 타스크 추가
          </div>
          <div
            className="context-menu-item"
            onClick={() => {
              const task = flattened.find((t) => t.id === contextMenu.taskId)
              if (task) openEditModal(task)
            }}
          >
            <Edit2 size={14} /> 상세보기
          </div>
          <div className="context-menu-item" style={{ color: '#ff6f6f' }} onClick={() => handleDeleteById(contextMenu.taskId)}>
            <Trash2 size={14} /> 삭제
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>
              {modalMode === 'create-root'
                ? '새 작업 (최상위)'
                : modalMode === 'create-sub'
                  ? '하위 작업 추가'
                  : '작업 상세 정보'}
            </h3>
            <form onSubmit={handleCreateOrUpdate}>
              <div className="form-group">
                <label>작업명</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <label style={{ margin: 0 }}>기간 (일수)</label>
                  <span className="badge" style={{ background: '#6366f1', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600 }}>
                    {form.start && form.end
                      ? `${Math.ceil((new Date(form.end).getTime() - new Date(form.start).getTime()) / (1000 * 60 * 60 * 24)) + 1}일간`
                      : '0일간'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>시작일</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="date"
                        value={form.start}
                        onChange={(e) => setForm({ ...form, start: e.target.value })}
                        style={{ colorScheme: 'dark' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        ({form.start ? new Date(form.start).toLocaleDateString('ko-KR', { weekday: 'short' }) : ''})
                      </span>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>종료일</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="date"
                        value={form.end}
                        onChange={(e) => setForm({ ...form, end: e.target.value })}
                        style={{ colorScheme: 'dark' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        ({form.end ? new Date(form.end).toLocaleDateString('ko-KR', { weekday: 'short' }) : ''})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>진척률 ({form.progress}%)</label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: '#6366f1' }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: Math.max(0, Math.min(100, Number(e.target.value))) })}
                    style={{ width: 60, textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>선행 작업 (WBS 번호)</label>
                <input
                  type="text"
                  placeholder="예: 1.1, 1.2 (쉼표로 구분)"
                  value={form.predecessorsWbs}
                  onChange={(e) => setForm({ ...form, predecessorsWbs: e.target.value })}
                />
                {form.predecessorsWbs && (
                  <div className="predecessor-preview">
                    {wbsToIds(form.predecessorsWbs).map((id) => {
                      const t = flattened.find((x) => x.id === id)
                      if (!t) return null
                      return (
                        <div key={id} className="pred-tag">
                          <span className="pred-wbs">{t.wbsNumber}</span>
                          <span className="pred-name">{t.name}</span>
                          <span className="pred-date">
                            {parseDate(t.end) ? new Date(parseDate(t.end)!).toLocaleDateString() : ''} 종료
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {modalMode !== 'create-root' && (
                <div className="form-group">
                  <label>상위 작업 정보</label>
                  <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, fontSize: '0.9rem', color: '#cbd5e1' }}>
                    {modalMode === 'create-sub'
                      ? (() => {
                        const p = flattened.find((t) => t.id === form.parentId)
                        return p ? `상위 작업: ${p.name} (${p.wbsNumber})` : '선택된 상위 작업 없음'
                      })()
                      : (() => {
                        const p = flattened.find((t) => t.id === form.parentId)
                        return p ? `상위 작업: ${p.name} (${p.wbsNumber})` : '최상위 작업 (Root)'
                      })()}
                  </div>
                </div>
              )}

              <div className="form-actions" style={{ marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', justifyContent: 'flex-end', display: 'flex' }}>
                <button type="button" className="pill pill-outline" onClick={() => setIsModalOpen(false)}>취소</button>
                <button type="submit" className="pill" style={{ background: '#6366f1', borderColor: '#6366f1', paddingLeft: 20, paddingRight: 20 }}>
                  <Save size={16} />
                  <span style={{ fontWeight: 600 }}>저장</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="card" style={{ marginTop: '1rem' }}>
        <p className="card-label">선택작업</p>
        {selectedTaskIds.size === 0 ? (
          <p className="muted">왼쪽 WBS에서 작업을 선택하면 상세 정보가 나타납니다.</p>
        ) : (
          (() => {
            const activeId = Array.from(selectedTaskIds)[0]
            const active = flattened.find((t) => t.id === activeId)
            if (!active) return <p className="muted">선택된 작업 정보를 불러올 수 없습니다.</p>
            const levelLabel = `레벨 ${active.depth + 1}`
            const predecessorsLabel = active.predecessors?.length ? idsToWbs(active.predecessors) : '-'
            const durationLabel = (() => {
              const s = parseDate(active.start)
              const e = parseDate(active.end)
              if (!s || !e) return '-'
              return `${Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1}일`
            })()
            const descendantTasks = flattened.filter(
              (t) => t.id !== active.id && t.wbsNumber.startsWith(`${active.wbsNumber}.`)
            )
            return (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 260px 120px 120px 1fr',
                  gap: '0.75rem',
                  alignItems: 'center',
                }}
              >
                <div><strong>WBS</strong><div>{active.wbsNumber}</div></div>
                <div><strong>작업명</strong><div>{active.name}</div></div>
                <div style={{ whiteSpace: 'nowrap' }}>
                  <strong>{durationLabel === '-' ? '작업기간' : `작업기간(${durationLabel})`}</strong>
                  <div>{active.start && active.end ? `${String(active.start).slice(0, 10)} ~ ${String(active.end).slice(0, 10)}` : '-'}</div>
                </div>
                <div><strong>진척율</strong><div>{active.progress}%</div></div>
                <div><strong>레벨</strong><div>{levelLabel}</div></div>
                <div><strong>선행작업</strong><div>{predecessorsLabel}</div></div>
                {descendantTasks.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
                    <strong>하위 작업</strong>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr 260px 120px 120px 1fr',
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                        alignItems: 'center',
                      }}
                    >
                      {descendantTasks.map((t) => {
                        const daysLabel = (() => {
                          const s = parseDate(t.start)
                          const e = parseDate(t.end)
                          if (!s || !e) return '-'
                          return `${Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1}일`
                        })()
                        const childPredecessors = t.predecessors?.length ? idsToWbs(t.predecessors) : '-'
                        const hasDates = t.start && t.end
                        return (
                          <React.Fragment key={t.id}>
                            <div style={{ color: '#8bd3ff' }}>{t.wbsNumber}</div>
                            <div>{t.name}</div>
                            <div style={{ whiteSpace: 'nowrap' }}>
                              <div>
                                {hasDates
                                  ? `${String(t.start).slice(0, 10)} ~ ${String(t.end).slice(0, 10)}${daysLabel !== '-' ? ` (${daysLabel})` : ''}`
                                  : '-'}
                              </div>
                            </div>
                            <div>{t.progress ?? 0}%</div>
                            <div>{`레벨 ${t.depth + 1}`}</div>
                            <div>{childPredecessors}</div>
                          </React.Fragment>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })()
        )}
      </div>
    </div>
  )
}

