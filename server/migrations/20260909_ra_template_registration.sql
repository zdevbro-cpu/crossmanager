-- 고객사 RA 양식 등록 — template / template_mapping 확장
--
-- 왜 필요한가
--   양식은 발주처마다 다르다. 실측 결과 열 배치·머리글 행·시트 수는 물론
--   등급 표기(크로스 A~E, 표준템플릿 상·중·하)까지 달랐다.
--   좌표를 코드에 박으면 고객사가 늘 때마다 코드를 고쳐야 하므로
--   양식 구조를 데이터로 보관하고 출력 시 읽어 쓴다. (개요서 3.1)

ALTER TABLE template
    ADD COLUMN IF NOT EXISTS project_id      uuid,           -- 현장 전용 양식(발주처보다 우선)
    ADD COLUMN IF NOT EXISTS header_row      integer,        -- 머리글 행(1-based)
    ADD COLUMN IF NOT EXISTS data_start_row  integer,        -- 데이터 첫 행(1-based)
    ADD COLUMN IF NOT EXISTS sheet_index     integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS grade_scale     varchar(20) DEFAULT 'A_E',  -- A_E | HIGH_MID_LOW | NUMERIC
    ADD COLUMN IF NOT EXISTS tail_marker     varchar(80),    -- 하단 안내문 — 데이터를 이 행 앞까지만 채운다
    ADD COLUMN IF NOT EXISTS header_cells    jsonb,          -- {siteName:{r,c}, writeDate:{r,c} ...}
    ADD COLUMN IF NOT EXISTS storage_key     varchar(255);   -- 양식 파일 위치(드라이브 file id 또는 로컬 경로)

-- 필드명 → 열 번호. target/source_expr 은 기존 렌더 엔진용이라 그대로 두고
-- RA 출력에 쓰는 단순 매핑만 별도 컬럼으로 둔다.
ALTER TABLE template_mapping
    ADD COLUMN IF NOT EXISTS field_key  varchar(40),   -- process | hazardDesc | freq | ...
    ADD COLUMN IF NOT EXISTS col_index  integer;       -- 1-based 열 번호

CREATE INDEX IF NOT EXISTS idx_template_project   ON template (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_template_client    ON template (client_id)  WHERE client_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tpl_mapping_tpl    ON template_mapping (template_id);
