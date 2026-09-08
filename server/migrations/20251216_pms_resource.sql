-- PMS Resource/Eligibility module schema (pilot)

-- Extensions (for UUID)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- person
CREATE TABLE IF NOT EXISTS person (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  birth_yyyymm CHAR(6),
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blocked')),
  role_tags TEXT[] NOT NULL DEFAULT '{}',
  masked_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_person_status ON person(status);
CREATE INDEX IF NOT EXISTS idx_person_role_tags ON person USING GIN(role_tags);

-- employment
CREATE TABLE IF NOT EXISTS employment (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  hire_type TEXT,
  grade TEXT,
  job_family TEXT,
  job_level TEXT,
  career_years NUMERIC(4,1),
  wage_type TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  org_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employment_person ON employment(person_id);
CREATE INDEX IF NOT EXISTS idx_employment_active ON employment(active_flag);

-- qualification master
CREATE TABLE IF NOT EXISTS qualification_cert (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  validity_months INT,
  needs_verification BOOLEAN NOT NULL DEFAULT true,
  alert_days INT[] NOT NULL DEFAULT ARRAY[90,60,30],
  active_flag BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_cert_active ON qualification_cert(active_flag);

CREATE TABLE IF NOT EXISTS qualification_training (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  validity_months INT,
  alert_days INT[] NOT NULL DEFAULT ARRAY[30,14,7],
  active_flag BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_training_active ON qualification_training(active_flag);

-- person cert/training
CREATE TABLE IF NOT EXISTS person_cert (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  cert_code TEXT NOT NULL REFERENCES qualification_cert(code),
  issued_at DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  evidence_uri TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(person_id, cert_code, expires_at)
);
CREATE INDEX IF NOT EXISTS idx_person_cert_expires ON person_cert(expires_at);
CREATE INDEX IF NOT EXISTS idx_person_cert_status ON person_cert(status);
CREATE INDEX IF NOT EXISTS idx_person_cert_person ON person_cert(person_id);

CREATE TABLE IF NOT EXISTS person_training (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  training_code TEXT NOT NULL REFERENCES qualification_training(code),
  taken_at DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  evidence_uri TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(person_id, training_code, expires_at)
);
CREATE INDEX IF NOT EXISTS idx_person_training_expires ON person_training(expires_at);
CREATE INDEX IF NOT EXISTS idx_person_training_status ON person_training(status);
CREATE INDEX IF NOT EXISTS idx_person_training_person ON person_training(person_id);

-- trade/work type
CREATE TABLE IF NOT EXISTS trade_group (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  active_flag BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS work_type (
  code TEXT PRIMARY KEY,
  group_code TEXT NOT NULL REFERENCES trade_group(code),
  name TEXT NOT NULL,
  required_certs_all TEXT[] NOT NULL DEFAULT '{}',
  required_certs_any TEXT[] NOT NULL DEFAULT '{}',
  required_trainings_all TEXT[] NOT NULL DEFAULT '{}',
  required_trainings_any TEXT[] NOT NULL DEFAULT '{}',
  min_role_counts JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  enforcement JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_flag BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_work_type_group ON work_type(group_code);
CREATE INDEX IF NOT EXISTS idx_work_type_active ON work_type(active_flag);

-- rules & overrides
CREATE TABLE IF NOT EXISTS eligibility_rule_version (
  id BIGSERIAL PRIMARY KEY,
  rule_id UUID NOT NULL DEFAULT gen_random_uuid(),
  work_type_code TEXT NOT NULL REFERENCES work_type(code),
  version INT NOT NULL,
  payload_json JSONB NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rule_id, version)
);
CREATE INDEX IF NOT EXISTS idx_rule_work_type ON eligibility_rule_version(work_type_code);
CREATE INDEX IF NOT EXISTS idx_rule_effective ON eligibility_rule_version(effective_from, effective_to);

CREATE TABLE IF NOT EXISTS override (
  id BIGSERIAL PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('project','site','permit')),
  scope_ref TEXT NOT NULL,
  work_type_code TEXT NOT NULL REFERENCES work_type(code),
  patch_json JSONB NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  reason TEXT,
  active_flag BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(scope, scope_ref, work_type_code, active_flag)
);
CREATE INDEX IF NOT EXISTS idx_override_scope_ref ON override(scope_ref);
CREATE INDEX IF NOT EXISTS idx_override_work_type ON override(work_type_code);
CREATE INDEX IF NOT EXISTS idx_override_approved_at ON override(approved_at);

-- assignment
CREATE TABLE IF NOT EXISTS assignment_request (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL,
  date DATE NOT NULL,
  work_type_code TEXT NOT NULL REFERENCES work_type(code),
  assignees TEXT[] NOT NULL,
  requested_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ar_project_date ON assignment_request(project_id, date);
CREATE INDEX IF NOT EXISTS idx_ar_work_type ON assignment_request(work_type_code);

CREATE TABLE IF NOT EXISTS assignment_result (
  id BIGSERIAL PRIMARY KEY,
  assignment_request_id BIGINT NOT NULL REFERENCES assignment_request(id) ON DELETE CASCADE,
  eligible BOOLEAN NOT NULL,
  assignee_results JSONB NOT NULL,
  rule_trace JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_request_id)
);
CREATE INDEX IF NOT EXISTS idx_ar_result_created ON assignment_result(created_at);

-- audit
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  diff JSONB,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);

-- Seed trade groups
INSERT INTO trade_group(code, name, sort_order) VALUES
('TG_EARTHWORK','토공',10),('TG_STEEL','철골',20),('TG_PIPING','배관',30),
('TG_ELECTRICAL','전기',40),('TG_INSTRUMENT','계장',50),('TG_LIFTING','하역/중장비',60),
('TG_WELDING','용접',70),('TG_DEMOLITION','철거',80),('TG_WASTE','폐기물',90)
ON CONFLICT (code) DO NOTHING;

-- Seed work types (pilot)
INSERT INTO work_type(code, group_code, name, required_certs_all, required_certs_any, required_trainings_all, enforcement) VALUES
('WT_EARTH_EXCAVATOR_OP','TG_EARTHWORK','굴착기 운전',ARRAY['CERT_EARTH_EXCAVATOR'],ARRAY[]::text[],ARRAY['TRN_SAFETY_BASIC'],'{"mode":"BLOCK","reason_code":"EXCAVATOR_LICENSE"}'),
('WT_LIFT_MOBILE_CRANE_OP','TG_LIFTING','이동식 크레인 운전',ARRAY['CERT_LIFT_CRANE_MOBILE'],ARRAY[]::text[],ARRAY['TRN_SAFETY_BASIC','TRN_LIFTING_SPECIAL'],'{"mode":"BLOCK","reason_code":"CRANE_LICENSE"}'),
('WT_LIFT_SIGNALMAN','TG_LIFTING','신호수',ARRAY[]::text[],ARRAY['CERT_LIFT_SIGNALMAN'],ARRAY['TRN_SAFETY_BASIC','TRN_LIFTING_SIGNAL'],'{"mode":"BLOCK","reason_code":"SIGNALMAN_REQUIRED"}'),
('WT_WELD_SMAW','TG_WELDING','피복아크 용접',ARRAY['CERT_WELD_SMAW'],ARRAY[]::text[],ARRAY['TRN_SAFETY_BASIC','TRN_WELDING_SAFETY'],'{"mode":"BLOCK","reason_code":"WELD_CERT_REQUIRED"}'),
('WT_ELEC_LOW_VOLT','TG_ELECTRICAL','저전압 전기배선',ARRAY['CERT_ELEC_WORKER_BASIC'],ARRAY['CERT_ELEC_ENGINEER_MANAGER','CERT_ELEC_TECH_MANAGER'],ARRAY['TRN_SAFETY_BASIC','TRN_ELECTRICAL_SPECIAL'],'{"mode":"BLOCK","reason_code":"ELECTRICAL_MANAGER_REQUIRED"}'),
('WT_DEMO_GENERAL','TG_DEMOLITION','일반 철거',ARRAY[]::text[],ARRAY[]::text[],ARRAY['TRN_SAFETY_BASIC','TRN_DEMOLITION_SPECIAL'],'{"mode":"WARN","reason_code":"DEMO_TRAINING_RECOMMENDED"}')
ON CONFLICT (code) DO NOTHING;

-- Seed certification master
INSERT INTO qualification_cert(code, name, validity_months, needs_verification, alert_days) VALUES
('CERT_SAFETY_GENERAL','기본 안전 자격',24,true,ARRAY[90,60,30]),
('CERT_HOT_WORK','화기 작업 자격',24,true,ARRAY[90,60,30]),
('CERT_CONFINED_SPACE','밀폐공간 작업 자격',24,true,ARRAY[90,60,30]),
('CERT_ELEC_WORKER_BASIC','전기기능사/전기산업기사 등',60,true,ARRAY[90,60,30]),
('CERT_ELEC_ENGINEER_MANAGER','전기기사(감리/책임자)',60,true,ARRAY[90,60,30]),
('CERT_ELEC_TECH_MANAGER','전기산업기사(관리자)',60,true,ARRAY[90,60,30]),
('CERT_LIFT_CRANE_MOBILE','이동식 크레인 면허',60,true,ARRAY[90,60,30]),
('CERT_LIFT_SIGNALMAN','신호수 자격',36,true,ARRAY[90,60,30]),
('CERT_LIFT_RIGGER','시스템비계·리깅 자격',36,true,ARRAY[90,60,30]),
('CERT_EARTH_EXCAVATOR','굴착기 조종사',60,true,ARRAY[90,60,30]),
('CERT_EARTH_LOADER','로더 조종사',60,true,ARRAY[90,60,30]),
('CERT_WELD_SMAW','피복아크 용접 자격',36,true,ARRAY[90,60,30]),
('CERT_WELD_GTAW','티그 용접 자격',36,true,ARRAY[90,60,30]),
('CERT_ASBESTOS_MANAGER','석면관리자',36,true,ARRAY[90,60,30]),
('CERT_DEMOLITION_MANAGER','건설기계 철거 관리자',36,true,ARRAY[90,60,30])
ON CONFLICT (code) DO NOTHING;

-- Seed training master
INSERT INTO qualification_training(code, name, validity_months, alert_days) VALUES
('TRN_SAFETY_BASIC','기본 안전교육',12,ARRAY[30,14,7]),
('TRN_SAFETY_HOT_WORK','화기 작업 안전교육',12,ARRAY[30,14,7]),
('TRN_SAFETY_CONFINED','밀폐공간 안전교육',12,ARRAY[30,14,7]),
('TRN_ELECTRICAL_SPECIAL','전기 특수교육',12,ARRAY[30,14,7]),
('TRN_LIFTING_SPECIAL','하역·중장비 특수교육',12,ARRAY[30,14,7]),
('TRN_LIFTING_SIGNAL','신호수 특수교육',12,ARRAY[30,14,7]),
('TRN_WELDING_SAFETY','용접 안전교육',12,ARRAY[30,14,7]),
('TRN_DEMOLITION_SPECIAL','철거 특수교육',12,ARRAY[30,14,7]),
('TRN_ASBESTOS_SPECIAL','석면 특수교육',12,ARRAY[30,14,7])
ON CONFLICT (code) DO NOTHING;
