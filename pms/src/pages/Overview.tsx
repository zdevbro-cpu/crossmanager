import './Page.css'

const summaryList = [
  {
    title: '프로젝트 기본정보',
    description: '코드, 명칭, 발주처, 주소, 공사기간, 보안등급, PM 정보, 고객사 규정 관리',
  },
  {
    title: '공정(WBS)·일정',
    description: '표준 WBS 템플릿 적용, 간트 차트, 선·후행, 지연 예상 강조, 변경 이력/승인 기록',
  },
  {
    title: '자원 연동',
    description: '공정별 장비·인력 자동 산정, 배차 현황, 충돌 자동 체크, 사용량 분석',
  },
  {
    title: '문서/보고',
    description: '일/주/월간 보고 자동 생성, 고객사 양식 변환, 도면·계약·허가 구조화 저장',
  },
]



function OverviewPage() {
  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Cross PMS</p>
          <h1>프로젝트 관리의 기준을 한 화면에서</h1>
          <p className="lede">
            프로젝트 기본정보·일정·자원·문서·보고를 PostgreSQL 기반으로 연결하고, 모바일/웹 어디서나 접근 가능한 PWA로 제공합니다.
          </p>
        </div>
        <div className="hero-card">
          <div className="hero-metric">
            <strong>Live</strong>
            <span>Cloud SQL 연동</span>
          </div>
          <div className="hero-metric">
            <strong>WBS</strong>
            <span>Gantt 자동 스케줄링</span>
          </div>
          <div className="hero-metric">
            <strong>보안</strong>
            <span>프로젝트별 ACL + 역할</span>
          </div>
        </div>
      </section>

      <section className="grid">
        {summaryList.map((item) => (
          <article key={item.title} className="card">
            <p className="card-label">{item.title}</p>
            <p className="card-text">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">개발 현황</p>
            <h2>기능 구현 마일스톤</h2>
          </div>
          <span className="badge badge-live">Live Demo</span>
        </div>
        <div className="milestone-grid">
          <div className="milestone">
            <p className="milestone-label">DB 연동 (PostgreSQL)</p>
            <p className="milestone-meta">
              <span>서버 구축 완료</span>
              <span className="pill pill-active">완료</span>
            </p>
          </div>
          <div className="milestone">
            <p className="milestone-label">WBS & Gantt 연동</p>
            <p className="milestone-meta">
              <span>스크롤 동기화/자동 일정</span>
              <span className="pill pill-active">완료</span>
            </p>
          </div>
          <div className="milestone">
            <p className="milestone-label">자원 관리</p>
            <p className="milestone-meta">
              <span>배정 충돌 로직 구현됨</span>
              <span className="pill pill-active">Front 완료</span>
            </p>
          </div>
          <div className="milestone">
            <p className="milestone-label">문서/보고서</p>
            <p className="milestone-meta">
              <span>구조화 UI 구현됨</span>
              <span className="pill">Back 대기</span>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default OverviewPage
