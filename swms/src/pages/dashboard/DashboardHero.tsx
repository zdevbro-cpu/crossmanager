import { useNavigate } from 'react-router-dom'

export default function DashboardHero(props: {
  title: string
  subtitle: string
  meta: string
  mode: 'operations' | 'executive'
}) {
  const navigate = useNavigate()

  return (
    <section className="swms-dashboard__hero">
      <div className="swms-dashboard__hero-inner">
        <div>
          <p className="eyebrow">{props.mode.toUpperCase()} VIEW</p>
          <h1 className="swms-dashboard__title">{props.title}</h1>
          <p className="swms-dashboard__subtitle">{props.subtitle}</p>
          <p className="swms-dashboard__meta">{props.meta}</p>
        </div>

        <div className="swms-dashboard__actions">
          <button className="pill pill-outline" onClick={() => window.location.reload()}>
            새로고침
          </button>
          <div className="segmented" role="tablist" aria-label="Dashboard mode">
            <button
              type="button"
              className={props.mode === 'executive' ? 'active' : ''}
              onClick={() => navigate('/dashboard/executive')}
            >
              Executive
            </button>
            <button
              type="button"
              className={props.mode === 'operations' ? 'active' : ''}
              onClick={() => navigate('/')}
            >
              Operations
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

