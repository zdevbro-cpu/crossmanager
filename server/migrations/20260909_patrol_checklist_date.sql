-- 패트롤·체크리스트에 실시일 추가
--
-- 왜 필요한가
--   달력에 얹으려면 "언제 하기로 한 일"인지가 있어야 한다. 두 표에는
--   created_at 밖에 없어 그것을 쓰면 "언제 입력했는지"가 찍힌다.
--   현장에서 어제 돈 순찰을 오늘 입력하면 날짜가 하루 어긋난다.
--
--   기존 행은 created_at 날짜로 채운다. 지금은 둘 다 0건이라 실제로
--   채워지는 것은 없지만, 나중에 쌓인 뒤 적용해도 같은 결과가 되도록 둔다.

ALTER TABLE sms_patrols
    ADD COLUMN IF NOT EXISTS date date;

ALTER TABLE sms_checklists
    ADD COLUMN IF NOT EXISTS date date;

UPDATE sms_patrols    SET date = created_at::date WHERE date IS NULL;
UPDATE sms_checklists SET date = created_at::date WHERE date IS NULL;

-- 앞으로 들어오는 행은 입력일을 기본값으로 둔다. 화면이 날짜를 보내면
-- 그 값이 우선한다.
ALTER TABLE sms_patrols    ALTER COLUMN date SET DEFAULT CURRENT_DATE;
ALTER TABLE sms_checklists ALTER COLUMN date SET DEFAULT CURRENT_DATE;

COMMENT ON COLUMN sms_patrols.date    IS '순찰 실시일. created_at(입력 시각)과 다르다';
COMMENT ON COLUMN sms_checklists.date IS '점검 실시일. created_at(입력 시각)과 다르다';

CREATE INDEX IF NOT EXISTS idx_patrols_date    ON sms_patrols (project_id, date);
CREATE INDEX IF NOT EXISTS idx_checklists_date ON sms_checklists (project_id, date);
