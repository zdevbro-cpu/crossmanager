-- tasks.predecessors 타입 정정
--
-- /api/tasks 는 선행 작업을 배열로 보낸다(기본값 []). text 로 두면
-- 등록할 때마다 타입 오류가 난다. API 가 이미 쓰는 형태에 맞춘다.
ALTER TABLE tasks
    ALTER COLUMN predecessors TYPE text[] USING
        CASE WHEN predecessors IS NULL OR predecessors = '' THEN NULL
             ELSE string_to_array(predecessors, ',') END;
