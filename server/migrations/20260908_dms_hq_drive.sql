-- ============================================================
-- 20260908_dms_hq_drive.sql
-- 근거: 크로스특수 통합관리시스템 상세설계서 v0.2
--   - 1.4.2 법정 문서 물리 삭제 금지
--   - 6.3   유효기간 2원 구분 (문서 보존연한)
--   - 9.4   민감정보 접근 통제 (열람·다운로드 전 건 기록)
--   - 12.1  무중단 원칙 — 기존 컬럼 rename·삭제 없음
--
-- 결정 사항
--   1) 문서를 '프로젝트 문서 / 본사 문서'로 구분. 본사는 고정 UUID로 지정
--   2) 파일 실물은 드라이브, 링크·메타는 DB (wbmanager와 동일 구조)
--   3) 현장 문서는 레퍼런스이므로 삭제 없음.
--      단 개인정보 포함 문서는 보존연한 경과 시 파기 (예외 인정)
--
-- 전 구문 재실행 가능(idempotent). ON_ERROR_STOP=1 로 적용할 것.
-- ============================================================

-- Windows psql 은 콘솔 코드페이지(949)를 client_encoding 으로 잡는다.
-- 이 파일은 UTF-8 이고 '본사' 같은 한글이 들어 있으므로 명시해야 깨지지 않는다.
SET client_encoding = 'UTF8';

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. 본사 구분
--    본사 문서는 project_id = '00000000-0000-0000-0000-000000000001'
--    애플리케이션에서 상수로 참조한다(환경별로 값이 달라지지 않게 고정).
-- ------------------------------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_hq BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN projects.is_hq IS
  '본사 구분. TRUE인 레코드는 현장이 아니므로 프로젝트 목록·공정·손익 집계에서 제외한다.';

INSERT INTO projects (id, code, name, is_hq, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'HQ', '본사', TRUE, 'RUNNING')
ON CONFLICT DO NOTHING;

-- 집계 쿼리에서 본사를 빼기 쉽도록 부분 인덱스를 둔다.
CREATE INDEX IF NOT EXISTS idx_projects_site_only
  ON projects (status) WHERE is_hq = FALSE;

-- ------------------------------------------------------------
-- 2. 삭제 방침 — 현장 문서는 레퍼런스, 삭제 없음
--    현행 ON DELETE CASCADE 는 '현장을 지우면 문서가 함께 사라지는' 구조라
--    방침과 정반대다. RESTRICT 로 바꿔 문서가 있는 현장은 삭제 자체를 막는다.
--    문서 자체의 제거는 deleted_at 논리 삭제로만 한다.
-- ------------------------------------------------------------
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'documents'::regclass
     AND contype  = 'f'
     AND confrelid = 'projects'::regclass;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE documents DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE documents
  ADD CONSTRAINT documents_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

COMMENT ON COLUMN documents.deleted_at IS
  '논리 삭제. NULL이 아니면 조회 제외. 법정 문서는 물리 삭제하지 않는다(설계서 1.4.2).';

CREATE INDEX IF NOT EXISTS idx_documents_live
  ON documents (project_id, created_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------
-- 3. 개인정보 파기 예외
--    "삭제 없음"은 현장 업무문서(RA·작업허가서·점검일지·사진대지)에 적용된다.
--    건강검진 결과서·자격증 사본·개인정보 동의서 등은 보존연한 경과 시
--    파기가 법적 의무이므로 별도 플래그로 구분한다.
-- ------------------------------------------------------------
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_personal_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS retention_until  DATE;

COMMENT ON COLUMN documents.is_personal_data IS
  '개인정보 포함 여부. TRUE인 문서만 보존연한 경과 시 파기 대상이 된다.';
COMMENT ON COLUMN documents.retention_until IS
  '법정 보존연한 만료일. 자격·보험의 유효기간과는 다른 개념이다(설계서 6.3).';

CREATE INDEX IF NOT EXISTS idx_documents_disposal
  ON documents (retention_until) WHERE is_personal_data = TRUE;

-- ------------------------------------------------------------
-- 4. 드라이브 저장
--    파일 실물은 드라이브에 두고 DB는 링크(파일 ID)만 갖는다.
--    버전 관리를 드라이브 리비전에 맡기지 않는다 — 바이너리 리비전은
--    keepForever 미지정 시 30일 후 자동 삭제되고 keepForever도 200개 상한이다.
--    따라서 버전마다 별도 파일을 올리고 계보는 이 테이블이 관리한다.
--    기존 file_path 는 삭제하지 않고 병행 유지한다(설계서 12.1).
-- ------------------------------------------------------------
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS storage_kind  VARCHAR(20) DEFAULT 'gdrive';
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(100);

COMMENT ON COLUMN document_versions.storage_kind IS
  'gdrive | firebase | local. 기존 데이터는 firebase/local, 신규는 gdrive.';
COMMENT ON COLUMN document_versions.drive_file_id IS
  '드라이브 파일 ID. 화면에는 노출하지 않는다 — 열람·다운로드는 서버가 중계한다.';

-- 기존 행은 드라이브 이전 데이터이므로 표시를 남긴다.
UPDATE document_versions
   SET storage_kind = 'firebase'
 WHERE storage_kind IS NULL OR (drive_file_id IS NULL AND storage_kind = 'gdrive');

CREATE INDEX IF NOT EXISTS idx_docver_drive ON document_versions (drive_file_id);

-- ------------------------------------------------------------
-- 5. 열람·다운로드 감사 로그 (설계서 9.4)
--    드라이브 링크를 화면에 노출하지 않고 서버가 중계하는 이유가 이것이다.
--    링크를 그대로 주면 앱을 거치지 않은 열람이 생겨 기록이 비게 된다.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_access_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
    version_id  UUID REFERENCES document_versions(id) ON DELETE SET NULL,
    user_id     UUID,
    action      VARCHAR(20) NOT NULL,   -- VIEW / DOWNLOAD / PRINT / EXPORT
    ip          VARCHAR(45),
    user_agent  TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_access_doc  ON document_access_log (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_access_user ON document_access_log (user_id, created_at DESC);

COMMENT ON TABLE document_access_log IS
  '민감문서 열람·다운로드 이력. 보존 5년(설계서 10.4).';

COMMIT;


-- ============================================================
-- 선택 작업 — 승인 후 별도 실행할 것 (이 파일에서는 실행하지 않는다)
--
-- 현행 코드는 project_id 가 없는 문서를 'global' 로 분기해 왔다
-- (Server/routes/documents.js — `documents/${pId || 'global'}/...`).
-- 그 문서들을 본사 문서로 승격하려면 아래를 실행한다.
-- 데이터 변경이므로 승인 범위 밖으로 두었다.
--
-- UPDATE documents
--    SET project_id = '00000000-0000-0000-0000-000000000001'
--  WHERE project_id IS NULL;
-- ============================================================


-- ============================================================
-- ROLLBACK — 필요 시 수동 실행
--
-- BEGIN;
-- DROP TABLE IF EXISTS document_access_log;
-- DROP INDEX IF EXISTS idx_docver_drive;
-- ALTER TABLE document_versions DROP COLUMN IF EXISTS drive_file_id;
-- ALTER TABLE document_versions DROP COLUMN IF EXISTS storage_kind;
-- DROP INDEX IF EXISTS idx_documents_disposal;
-- ALTER TABLE documents DROP COLUMN IF EXISTS retention_until;
-- ALTER TABLE documents DROP COLUMN IF EXISTS is_personal_data;
-- DROP INDEX IF EXISTS idx_documents_live;
-- ALTER TABLE documents DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_project_id_fkey;
-- ALTER TABLE documents ADD CONSTRAINT documents_project_id_fkey
--   FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
-- DROP INDEX IF EXISTS idx_projects_site_only;
-- DELETE FROM projects WHERE id = '00000000-0000-0000-0000-000000000001';
-- ALTER TABLE projects DROP COLUMN IF EXISTS is_hq;
-- COMMIT;
-- ============================================================
