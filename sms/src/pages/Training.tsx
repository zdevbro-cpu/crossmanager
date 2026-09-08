import './Page.css'
import { educationRequirements } from '../data/requirements'

const alerts = [
  { label: '30일', color: 'badge-tag', desc: '만료 30일 전 알림' },
  { label: '60일', color: 'badge', desc: '만료 60일 전 알림' },
  { label: '90일', color: 'badge', desc: '만료 90일 전 알림' },
]

function TrainingPage() {
  return (
    <div className="page">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">교육·자격</p>
            <h2>교육/자격증 관리</h2>
            <p className="muted">법정교육, 특별교육, 자격증 만료를 한 번에 추적합니다.</p>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <p className="card-label">이력 관리</p>
            <p className="card-text">교육명, 이수일, 유효기간을 기록하고 자료(PDF/영상)를 보관</p>
          </div>
          <div className="card">
            <p className="card-label">만료 알림</p>
            <p className="card-text">30/60/90일 기준으로 사용자/관리자에게 알림 발송</p>
            <div className="tag-row" style={{ marginTop: '0.5rem' }}>
              {alerts.map((alert) => (
                <span key={alert.label} className={`badge ${alert.color}`}>
                  {alert.desc}
                </span>
              ))}
            </div>
          </div>
          <div className="card">
            <p className="card-label">자격증 관리</p>
            <p className="card-text">자격증 번호/유효기간과 스캔본을 저장, 만료시 갱신 요청</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">요구사항</p>
            <h2>ID별 정의</h2>
          </div>
          <span className="badge badge-tag">{educationRequirements.length}개</span>
        </div>

        <div className="grid two">
          {educationRequirements.map((item) => (
            <div key={item.id} className="card">
              <p className="card-label">{item.id}</p>
              <p className="card-text">
                <strong>{item.title}</strong> · {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default TrainingPage
