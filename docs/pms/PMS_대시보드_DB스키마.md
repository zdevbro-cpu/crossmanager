# PMS 대시보드용 DB 스키마 (임원용/실무자용 공통 기반)

## 1. 개요
- 목적: Health Score/위험 Top5/의사결정 알림을 빠르게 제공하기 위한 **집계 전용 스키마**.
- 원천: 기존 PMS(계약/원가/문서), EMS(장비), SMS(안전 체크리스트/NC/Near-miss), 스크랩/정산.
- 주기: 일 1회 집계(임원용), 핵심 지표 2~4시간 캐시 갱신(운영), 실시간 이벤트(사고/알림).
- 권한: 모든 테이블은 `project_id` 기반 RLS/권한 필터 적용(임원=요약, 실무자=상세 드릴다운).

## 2. 핵심 테이블
### 2.1 dashboard_health_daily
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | bigserial PK | |
| project_id | uuid FK projects.id | 프로젝트 |
| calc_date | date | 산출 일자 |
| score_total | numeric(5,2) | Health Score (0~100) |
| score_schedule | numeric(5,2) | S |
| score_safety | numeric(5,2) | Sa |
| score_cost | numeric(5,2) | C |
| score_resource | numeric(5,2) | R |
| score_quality | numeric(5,2) | Q |
| grade | text | GREEN/YELLOW/ORANGE/RED |
| forced_red | boolean | 강제 Red 규칙 적용 여부 |
| top_reasons | jsonb | [{type:'safety_nc', value:3, weight:8}, ...] |
| data_quality_flag | jsonb | {schedule:'ok', safety:'missing', ...} |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2.2 dashboard_risks
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | bigserial PK | |
| project_id | uuid | |
| calc_date | date | |
| risk_type | text | 'safety', 'schedule', 'cost', 'resource', 'scrap' |
| title | text | 요약 메시지(예: "미조치 NC 3건") |
| severity | text | info/warn/critical |
| metrics | jsonb | 관련 지표(미이행률, 지연율 등) |
| created_at | timestamptz | |

### 2.3 dashboard_alerts (의사결정 카드)
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | bigserial PK | |
| project_id | uuid | |
| alert_type | text | 'approval_pending','safety_nc','loss_risk','equipment_fault','scrap_issue' 등 |
| title | text | 카드 제목 |
| detail | text | 상세 설명 |
| status | text | open/ack/closed |
| severity | text | warn/critical |
| action_url | text | 드릴다운 링크 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2.4 dashboard_data_quality
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | bigserial PK | |
| project_id | uuid | |
| calc_date | date | |
| domain | text | schedule/safety/cost/resource/quality/scrap |
| status | text | ok/partial/missing |
| missing_fields | jsonb | 예: ["checklist_submit_rate","eac"] |
| created_at | timestamptz | |

### 2.5 dashboard_weights (운영 튜닝)
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | bigserial PK | |
| effective_from | date | 적용 시작일 |
| w_schedule | numeric(4,3) | 기본 0.25 |
| w_safety | numeric(4,3) | 기본 0.30 |
| w_cost | numeric(4,3) | 기본 0.20 |
| w_resource | numeric(4,3) | 기본 0.15 |
| w_quality | numeric(4,3) | 기본 0.10 |
| penalty_rules | jsonb | 크리티컬 지연 -15, 사고 -30~-70 등 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2.6 dashboard_scores_log (선택)
| 컬럼 | 타입 | 설명 |
| --- | --- | --- |
| id | bigserial PK | |
| project_id | uuid | |
| calc_time | timestamptz | 실행 시각 |
| inputs | jsonb | 원천 지표 스냅샷 |
| outputs | jsonb | 영역별 점수/총점/등급 |
| duration_ms | int | 실행 시간 |
| created_at | timestamptz | |

## 3. API/권한 설계 요약
- Executive: `/api/dashboard/executive/*` → `dashboard_health_daily`, `dashboard_risks`, `dashboard_alerts` 집계 결과만 반환(요약, 드릴다운 링크).
- Operations: `/api/dashboard/operations/*` → 동일 데이터 + 실무 드릴다운 허용(프로젝트 상세/조치 링크).
- Role 미들웨어: `executive`는 요약/읽기 전용, `pm/manager`는 해당 프로젝트 상세, `field`는 본인 현장 제한.

## 4. 배치/집계 플로우
1) 원천 추출: PMS/EMS/SMS/스크랩 DB에서 필요한 지표 쿼리.
2) 스코어 계산 워커: 영역별 점수 + 강제 Red + Top3 원인 계산.
3) 저장: `dashboard_health_daily`, `dashboard_risks`, `dashboard_alerts`, `dashboard_data_quality`에 upsert.
4) 캐싱: Top 위험 프로젝트/요약 바는 Redis 등 메모리 캐시로 2~4시간 TTL.
5) 모니터링: 집계 실패/지연 알림, 데이터 품질 누락 알림.

## 5. 마이그레이션 메모
- `dashboard_*` 테이블은 별도 스키마(`dashboard`) 생성 권장.
- `project_id`는 기존 프로젝트 테이블 FK 사용(이미 존재한다고 가정).
- JSONB 컬럼은 인덱스 필요시 `GIN` 추가(예: `top_reasons`, `metrics`).
