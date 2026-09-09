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

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useProjects()
  const projects = data || []
  const [selectedId, setSelectedId] = useState<string>('')

  useEffect(() => {
    if (projects.length > 0) {
      // 항상 첫 번째 프로젝트를 기본값으로 선택 (사용자 요구사항)
      // 단, 이미 유효한 선택이 있다면 유지 (예: 탭 이동 등) - 하지만 리프레시 시에는 state가 초기화되므로 첫 번째가 됨
      if (!selectedId || !projects.find(p => p.id === selectedId)) {
        setSelectedId(projects[0].id)
      }
    }
  }, [projects, selectedId])

  // localStorage 저장 로직 제거

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
