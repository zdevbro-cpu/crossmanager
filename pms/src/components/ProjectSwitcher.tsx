import { useProjectContext } from '../context/ProjectContext'

function ProjectSwitcher() {
  const { projects, selectedId, setSelectedId, isLoading, isError } = useProjectContext()

  return (
    <div className="project-switcher">
      <label>
        <span>프로젝트</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={isLoading || projects.length === 0}
        >
          {/* 표기는 [코드] 명칭 으로 모듈 간 통일한다. */}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code ? `[${p.code}] ` : ''}{p.name}
            </option>
          ))}
        </select>
      </label>
      {isError && <small className="muted">불러오기 오류, 샘플 사용</small>}
    </div>
  )
}

export default ProjectSwitcher
