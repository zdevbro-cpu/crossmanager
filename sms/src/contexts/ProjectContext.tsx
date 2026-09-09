import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { apiClient } from '../lib/api'

interface Project {
    id: string
    code: string
    name: string
    client: string
    address: string
    pm: string
    regulation: string
    status: string
    startDate: string
    endDate: string
    securityLevel: string
}

interface ProjectContextType {
    projects: Project[]
    selectedProjectId: string
    selectedProject: Project | null
    setSelectedProjectId: (id: string) => void
    loading: boolean
    refreshProjects: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

// 고른 현장은 화면을 옮기거나 모듈을 다녀와도 그대로여야 한다.
// React 상태만 두면 새로 고침·모듈 이동에서 전부 초기화된다.
// 모듈이 같은 도메인에 있어 키를 공유하면 SMS 에서 고른 현장이 PMS 에서도 이어진다.
const STORAGE_KEY = 'cross.selectedProjectId'

const readStored = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'ALL'
    } catch {
        return 'ALL'
    }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProjectId, setSelectedProjectIdState] = useState<string>(readStored)
    const [loading, setLoading] = useState(true)

    const setSelectedProjectId = (id: string) => {
        setSelectedProjectIdState(id)
        try {
            localStorage.setItem(STORAGE_KEY, id)
        } catch {
            // 시크릿 모드 등 저장이 막힌 환경. 이번 세션 동안만 유지된다.
        }
    }

    const fetchProjects = async () => {
        try {
            setLoading(true)
            const res = await apiClient.get('/projects')
            setProjects(res.data)

            // 저장된 현장이 지워졌거나 권한이 빠졌을 수 있다.
            // 목록에 없으면 전체로 되돌린다. 없는 현장이 걸려 있으면 화면이 빈다.
            setSelectedProjectIdState(prev => {
                if (prev === 'ALL') return prev
                return res.data.some((p: Project) => p.id === prev) ? prev : 'ALL'
            })
        } catch (err) {
            console.error('Failed to fetch projects:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchProjects()
    }, [])

    const selectedProject = selectedProjectId === 'ALL'
        ? null
        : projects.find(p => p.id === selectedProjectId) || null

    const value: ProjectContextType = {
        projects,
        selectedProjectId,
        selectedProject,
        setSelectedProjectId,
        loading,
        refreshProjects: fetchProjects
    }

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject() {
    const context = useContext(ProjectContext)
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider')
    }
    return context
}
