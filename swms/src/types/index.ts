export interface Company {
    id: string
    code: string
    name: string
    registration_number?: string
    ceo_name?: string
    address?: string
}

export interface Site {
    id: string
    company_id: string
    code: string
    name: string
    type: 'FACTORY' | 'HEADQUARTERS' | 'CONSTRUCTION_SITE'
    address?: string
    is_active: boolean
    company_name?: string
}

export interface Warehouse {
    id: string
    site_id: string
    code: string
    name: string
    type: 'INDOOR' | 'OUTDOOR' | 'YARD'
    capacity?: number
    unit?: string
    description?: string
    is_active: boolean
}

export interface MaterialType {
    id: string
    code: string
    name: string
    category: string
    unit: string
    unit_price?: number
    description?: string
}

export interface Vendor {
    id: string
    code: string
    name: string
    type: string
}
