import { Users } from 'lucide-react'
import './Page.css'

export default function VendorsPage() {
    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <p className="eyebrow">SWMS Module</p>
                    <h1>거래처 관리</h1>
                    <p className="muted">매각 업체 및 처리 업체를 관리합니다.</p>
                </div>
            </header>

            <section className="empty-state">
                <Users size={48} className="empty-icon" />
                <h3>거래처 관리 페이지</h3>
                <p>거래처 정보 및 계약 관리 기능이 구현될 예정입니다.</p>
            </section>
        </div>
    )
}
