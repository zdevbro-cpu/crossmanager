import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import type { Project } from '../types/pms'

type ProjectContextValue = {
  projects: Project[]
  selectedId: string
  setSelectedId: (id: string) => void
  selectedProject?: Project
  isLoading: boolean
  isError: boolean
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

// 고른 프로젝트는 화면을 옮기거나 모듈을 다녀와도 그대로여야 한다.
// React 상태만 두면 새로 고침·모듈 이동에서 첫 번째 프로젝트로 돌아간다.
// 모듈이 같은 도메인에 있어 키를 공유하면 SMS 에서 고른 현장이 여기서도 이어진다.
// (SMS 의 '전체' 는 PMS 에 해당 항목이 없어 첫 프로젝트로 떨어진다)
const STORAGE_KEY = 'cross.selectedProjectId'

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useProjects()
  const projects = data || []
  const [selectedId, setSelectedIdState] = useState<string>(readStored)

  const setSelectedId = (id: string) => {
    setSelectedIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // 시크릿 모드 등 저장이 막힌 환경. 이번 세션 동안만 유지된다.
    }
  }

  useEffect(() => {
    if (projects.length > 0) {
      // 저장된 프로젝트가 지워졌거나 권한이 빠졌을 수 있다.
      // 목록에 없을 때만 첫 번째로 떨어뜨린다. 있으면 그대로 둔다.
      if (!selectedId || !projects.find(p => p.id === selectedId)) {
        setSelectedIdState(projects[0].id)
      }
    }
  }, [projects, selectedId])

  const value = useMemo(
    () => ({
      projects,
      selectedId,
      setSelectedId,
      selectedProject: projects.find((p) => p.id === selectedId),
      isLoading,
      isError,
    }),
    [projects, selectedId, isLoading, isError],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('ProjectContext가 초기화되지 않았습니다.')
  return ctx
}
