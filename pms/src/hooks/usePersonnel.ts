import { useEffect, useState } from 'react'

export interface Personnel {
    id: string
    name: string
    role: string
    qualifications?: string[]
    security_clearance?: string
    status?: string
}

export function usePersonnel() {
    const [personnel, setPersonnel] = useState<Personnel[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isError, setIsError] = useState(false)

    useEffect(() => {
        const fetchPersonnel = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/personnel/pm-list')
                if (!response.ok) throw new Error('Failed to fetch')
                const data = await response.json()
                setPersonnel(data)
                setIsError(false)
            } catch (error) {
                console.error('Error fetching personnel:', error)
                setIsError(true)
                // Fallback to mock data
                setPersonnel([
                    { id: 'p3', name: '이PM', role: 'PM' },
                    { id: 'p4', name: '최PM', role: 'PM' },
                    { id: 'p5', name: '정PM', role: 'PM' },
                ])
            } finally {
                setIsLoading(false)
            }
        }

        fetchPersonnel()
    }, [])

    return { personnel, isLoading, isError }
}
