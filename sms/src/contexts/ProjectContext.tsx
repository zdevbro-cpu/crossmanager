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

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL')
    const [loading, setLoading] = useState(true)

    const fetchProjects = async () => {
        try {
            setLoading(true)
            const res = await apiClient.get('/projects')
            setProjects(res.data)

            // Default to 'ALL' - don't auto-select first project
            // User must explicitly choose a project
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
