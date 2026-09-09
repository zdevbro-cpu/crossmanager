-- 프로젝트 테이블 정리
--
-- 왜 필요한가
--   화면은 착수일·종료일·PM·보안등급·주소를 입력받는데 테이블에 그 컬럼이
--   없다. POST/PUT /api/projects 가 없는 컬럼을 참조해 저장이 실패하고,
--   목록의 「발주처」가 비고 「기간」이 undefined ~ undefined 로 나온다.
--
--   발주처는 문자열 컬럼을 새로 만들지 않는다. 자유 입력이면 「삼성물산」
--   「삼성 물산」 「(주)삼성물산」이 각각 다른 값으로 쌓인다.
--   이미 있는 client_id 로 마스터를 참조한다. 규제 유형도 client 에서 온다.

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS address        varchar(255),
    ADD COLUMN IF NOT EXISTS start_date     date,
    ADD COLUMN IF NOT EXISTS end_date       date,
    ADD COLUMN IF NOT EXISTS security_level varchar(20),
    ADD COLUMN IF NOT EXISTS pm_name        varchar(60),
    ADD COLUMN IF NOT EXISTS description    text,
    ADD COLUMN IF NOT EXISTS updated_at     timestamp NOT NULL DEFAULT NOW();

COMMENT ON COLUMN projects.client_id IS '발주처. client 마스터를 참조한다(자유 입력 금지)';

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects (client_id) WHERE client_id IS NOT NULL;
