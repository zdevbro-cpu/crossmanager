import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { apiClient } from '../lib/api'
import type { Site, Company, Warehouse } from '../types'

interface SiteContextType {
    company: Company | null
    sites: Site[]
    currentSite: Site | null
    warehouses: Warehouse[]
    setCurrentSite: (site: Site) => void
    loading: boolean
    refreshSites: () => Promise<void>
}

const SiteContext = createContext<SiteContextType | undefined>(undefined)

export function SiteProvider({ children }: { children: ReactNode }) {
    const [company, setCompany] = useState<Company | null>(null)
    const [sites, setSites] = useState<Site[]>([])
    const [currentSite, setCurrentSite] = useState<Site | null>(null)
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [loading, setLoading] = useState(true)

    const fetchSiteData = async () => {
        try {
            setLoading(true)
            // 임시: 단일 회사/사이트 구조라고 가정하고 첫 번째 데이터를 가져옴
            // 실제로는 로그인한 유저의 소속 회사/사이트를 가져와야 함 API 구현 필요
            // 여기서는 DB 초기화 시 생성한 데이터를 하드코딩된 API나 쿼리로 가정하거나
            // 우선 임시 엔드포인트를 호출한다고 가정.

            // NOTE: 현재 백엔드에 /swms/sites 엔드포인트가 없으므로 생성 필요.
            // 일단 에러 방지를 위해 Mock 데이터 사용 또는 API 호출 시도
            const res = await apiClient.get('/swms/sites/my') // 가상의 내 사이트 목록 API

            if (res.data && res.data.sites) {
                setCompany(res.data.company)
                setSites(res.data.sites)
                // 기본값: 첫 번째 사이트
                if (res.data.sites.length > 0) {
                    const firstSite = res.data.sites[0]
                    setCurrentSite(firstSite)
                    // 해당 사이트의 창고 목록 로드
                    fetchWarehouses(firstSite.id)
                }
            }
        } catch (err) {
            console.error('Failed to fetch site data:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchWarehouses = async (siteId: string) => {
        try {
            const res = await apiClient.get(`/swms/sites/${siteId}/warehouses`)
            setWarehouses(res.data)
        } catch (err) {
            console.error(err)
            setWarehouses([])
        }
    }

    const handleSetCurrentSite = (site: Site) => {
        setCurrentSite(site)
        fetchWarehouses(site.id)
    }

    useEffect(() => {
        fetchSiteData()
    }, [])

    const value: SiteContextType = {
        company,
        sites,
        currentSite,
        warehouses,
        setCurrentSite: handleSetCurrentSite,
        loading,
        refreshSites: fetchSiteData
    }

    return (
        <SiteContext.Provider value={value}>
            {children}
        </SiteContext.Provider>
    )
}

export function useSite() {
    const context = useContext(SiteContext)
    if (context === undefined) {
        throw new Error('useSite must be used within a SiteProvider')
    }
    return context
}
