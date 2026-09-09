-- 프로젝트 상태 값 통일
--
-- 왜 필요한가
--   같은 '진행중'을 뜻하는 값이 ACTIVE 와 RUNNING 두 가지로 쌓여 있었다.
--   화면 필터나 집계에서 한쪽만 걸리면 프로젝트가 빠진다.
--   ACTIVE 로 통일한다.

UPDATE projects SET status = 'ACTIVE' WHERE status = 'RUNNING';

-- 공통코드에서도 RUNNING 을 뺀다.
-- 지우지 않고 비활성으로 둔다. 지난 기록이 이 코드를 참조하고 있을 수 있다.
UPDATE code SET is_active = FALSE, updated_at = NOW()
 WHERE group_code = 'PROJECT_STATUS' AND code = 'RUNNING';

UPDATE code SET name = '진행', sort_order = 1, updated_at = NOW()
 WHERE group_code = 'PROJECT_STATUS' AND code = 'ACTIVE';

-- 앞으로 들어오는 값도 막는다. 값이 갈라지면 같은 문제가 되풀이된다.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_chk;
ALTER TABLE projects
    ADD CONSTRAINT projects_status_chk
    CHECK (status IS NULL OR status IN ('PLANNED', 'ACTIVE', 'HOLD', 'DONE'));
