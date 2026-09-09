-- 일정(WBS) 작업 테이블
--
-- 왜 필요한가
--   /api/tasks 는 GET·POST·PUT·DELETE 가 다 있는데 테이블이 없었다.
--   일정(WBS) 화면이 열리지 않고, 보고서 생성도 이 테이블을 집계하다
--   relation "tasks" does not exist 로 통째로 실패했다.
--
-- 컬럼은 기존 API 가 이미 쓰고 있는 것에 맞춘다. 새로 정하지 않는다.
--   GET  : id · project_id · parent_task_id · name · start_date · end_date ·
--          progress · status · sort_order · predecessors · weight · delay_risk
--   POST : 위와 같고 id 는 없으면 생성

CREATE TABLE IF NOT EXISTS tasks (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     uuid NOT NULL REFERENCES projects(id),
    parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
    name           varchar(200) NOT NULL,
    start_date     date,
    end_date       date,
    progress       integer NOT NULL DEFAULT 0,
    status         varchar(20),
    sort_order     integer NOT NULL DEFAULT 0,
    predecessors   text,          -- 선행 작업. API 가 문자열로 주고받는다
    weight         numeric,       -- 공정률 가중치
    delay_risk     varchar(20),   -- 지연 위험 표시
    created_at     timestamp NOT NULL DEFAULT NOW(),
    updated_at     timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent  ON tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_range   ON tasks (project_id, start_date, end_date);

COMMENT ON TABLE tasks IS '일정(WBS) 작업. 보고서 생성이 기간별로 집계한다';
