# SWMS 통합 대시보드 설계서 (계획)

## 0. 문서 목적
- `docs/swms/SWMS 통합 대시보드 기능 명세서.pdf`의 요구사항을 기준으로, **현재 Cross 프로젝트의 SWMS 모듈(프론트/백엔드/DB)**에서 대시보드를 구현 가능한지와 **필요 설계 변경 영향도**를 정리한다.
- 리스크를 통제하기 위해 **단계적(Phase) 구현 아키텍처**를 제안하고, 구현 범위·데이터 모델·API·일정을 “계획” 수준으로 확정한다.

## 1. 현행(AS-IS) 요약
### 1.1 프론트엔드(SWMS)
- 위치: `SWMS/`
- 기술: Vite + React, `@tanstack/react-query`, `axios`, `recharts`
- 현행 대시보드: `SWMS/src/pages/Dashboard.tsx`
  - KPI 3개(`totalGeneration`, `totalSales`, `totalStockCount`) + 일별 추이 1개(최근 N일)
  - API: `/api/swms/analytics/dashboard/kpi`, `/api/swms/analytics/generation/daily`

### 1.2 백엔드(Server)
- 위치: `Server/` (Express + PostgreSQL `pg`)
- SWMS 라우트:
  - `Server/routes/swms.js`: SWMS 도메인 데이터 CRUD(발생/계근/입출고/재고/정산 등)
  - `Server/routes/swms_analytics.js`: 대시보드 KPI/추이(현재 **Mock/Random** 반환)

### 1.3 데이터(현재 스키마 기반으로 확인된 핵심 컬럼)
- `swms_weighings`: `vehicle_number`, `vendor_id`, `material_type_id`, `direction(IN/OUT)`, `gross/tare/net_weight`, `weighing_date/time`
- `swms_inbounds`, `swms_outbounds`: `project_id`, `vendor_id`, `material_type_id`, `quantity`, `unit_price`, `total_amount`, `status`, `inbound_date/outbound_date`
- `swms_inventory`: `(site_id, warehouse_id, material_type_id)`별 `quantity`
- `swms_settlements`: `vendor_id`, `start_date/end_date`, `total_*`, `status(DRAFT/...)`, `tax_invoice_no`

## 2. 요구사항(TO-BE) 핵심 요약 (PDF 발췌)
### 2.1 KPI 패널(“오늘의 현황”)
- 금일 입고/반출량(전일 대비 증감)
- 배차 진행률(완료/전체 계획)
- 현재 재고 현황(적정재고 대비)
- 월 누적 처리량(목표 대비)
- 매출 현황(예상 매출 vs 확정 매출)
- 수익/비용 추정액(스크랩 매출 vs 폐기물 처리비)
- 정산 지연 현황(단계별 지연 금액/건수)
- 이상 징후 통합(운영/품질/규정)

### 2.2 메인 차트
- 재고 흐름 분석(Sankey/Funnel): 입고→선별→보관→출고→정산
- 품목/등급별 재고 Heatmap
- 단가/마진 추이 Line(추세선/비교선 포함)
- 자원 포트폴리오 Donut(스크랩/폐기물 비중 등)
- 시간대별 반출 추이 Bar/Line

### 2.3 실시간 운영/작업 큐
- Gate Status(입차 대기/작업 중/반출 완료)
- 오늘의 작업 큐(출고 예정/검수 대기/정산 대기)
- 이상 알림 처리(무게 편차/등급 급변/재고 음수 등)
- 차량 순환율(Turnaround Time) + SLA 경고

### 2.4 리스크/컴플라이언스
- 계근 편차 탐지(임계치 ±%)
- 등급 변경/클레임 관리
- 체류시간(SLA) 관리(리드타임 통계 + 지연 원인 Top5)
- 올바로(Allbaro) 연동 관리(실시간/준실시간 동기화, 성공/실패 구분, 즉시 처리 링크)
- 계근 증빙 갤러리(이미지 스트림)

### 2.5 재무 분석
- 월간 예상 현금 흐름(청구 가능/청구 완료/입금 완료)
- 미수금 Aging
- 거래처별 수익성 랭킹(가중치 기반)

### 2.6 기술 가이드라인
- 백엔드 집계 최적화: PostgreSQL Materialized View(`swms_daily_stats` 등) + 주기적 갱신
- 프론트 차트: Recharts 또는 Nivo 권장(현행 Recharts)
- 실시간 동기화: Firestore(onSnapshot) 또는 WebSocket
- AI 이상치(1단계): 규칙 기반을 넘어 패턴 기반 경고(설명 가능한 메시지)

## 3. 갭 분석 및 영향도(현재 모듈 기준)
### 3.1 “바로 구현 가능(또는 경미한 변경)” 범위
- **금일 입고/반출량**: `swms_inbounds/outbounds`(일자 기준 합계)로 산출 가능
- **현재 재고 현황(총량/품목별)**: `swms_inventory` 기반 가능(단, “적정재고” 기준 데이터는 추가 필요)
- **월 누적 처리량**: `swms_inbounds/outbounds` 또는 `swms_generations` 합계로 정의 가능(업무 정의 확정 필요)
- **매출 현황(확정 매출)**: `swms_outbounds` 상태(예: APPROVED/SETTLED)와 `total_amount` 기반 가능
- **시간대별 반출 추이**: `swms_weighings(direction='OUT')`의 `weighing_time`/`net_weight`로 가능
- **계근 편차(규칙 기반 1차)**: `swms_weighings`의 `vehicle_number/vendor/material` 조합 과거 평균 대비 임계치 초과 탐지 가능

### 3.2 “구현은 가능하지만 설계/스키마 확장 필요” 범위
- **배차 진행률**: “배차 계획(전체)” 데이터가 현재 스키마에 없음 → `swms_dispatch_plans`(계획/완료) 신설 필요
- **재고 흐름 Sankey(입고→선별→보관→출고→정산)**: 선별/보관/정산 단계별 “상태 전이” 데이터가 불완전
  - 최소안: 기존 테이블/상태로 단계 축약(입고/재고/출고/정산) 후 Sankey 구현
  - 정합안: `swms_process_events` 또는 각 도메인 테이블에 “단계/상태/시간” 보강
- **품목/등급 Heatmap**: 등급(A/B/C) 구분을 반영하려면 `grade` 컬럼이 집계 키에 포함되어야 함(입고/출고/재고)
- **정산 지연(단계별)**: 송장/검수/세금계산서/입금 등 단계 데이터 부재 → 정산 워크플로우 컬럼/테이블 확장 필요
- **작업 큐(출고 예정/검수 대기/정산 대기)**: “준비상태(계근표/사진/라벨)” 등의 체크 항목이 부재 → 체크리스트/첨부 테이블 필요
- **Turnaround Time**: “입차~출차” 정의가 필요(계근 1회/2회인지, Gate 이벤트인지) → 이벤트 모델 확정 필요
- **올바로(Allbaro) 연동**: 외부 연동(자격/키/연계범위) + 동기화 상태 저장 구조 필요
- **계근 증빙 갤러리**: `swms_weighings`에 첨부(이미지) 참조 구조 필요(서버 uploads 또는 documents 모듈 연계)

### 3.3 주요 리스크(현 시점)
- `Server/routes/swms_analytics.js`가 **Mock/Random** → 대시보드 신뢰도/의사결정 기능이 현재는 불가
- `Server/routes/swms.js`에 **개발 편의용 스키마 재초기화(테이블 DROP/재생성)** 로직 존재 → 운영 적용 시 데이터 소실 리스크(운영/개발 분리 또는 마이그레이션 체계 필요)
- 데이터 정의(처리량/확정매출/원가/등급/배차/정산단계/Allbaro) 중 일부가 “정책 결정” 없이 구현 불가

## 4. 제안 아키텍처(단계적)
### 4.1 원칙
- **Phase 1(MVP)**: “현행 테이블로 산출 가능한 지표/차트” 우선 구현 + 부족한 데이터는 최소 스키마 확장으로 채움
- **Phase 2(정합/확장)**: 작업 큐/컴플라이언스/재무 워크플로우를 정합하게 모델링(문서/증빙/외부연동 포함)
- **Phase 3(AI)**: 규칙 기반 탐지 → 패턴 기반 탐지로 확장(설명 가능한 경고)

### 4.2 백엔드 데이터 집계(성능)
- 목표: 프론트에서 집계/조합을 최소화하고, API는 “대시보드에 필요한 형태”로 제공
- 방안(권장): PostgreSQL Materialized View + 주기적 갱신
  - 예시(초안): `swms_dashboard_kpi_daily`, `swms_dashboard_outbound_hourly`, `swms_dashboard_inventory_heatmap`
  - 갱신 주기: 1~5분(운영 패널), 10~30분(KPI/리포트)로 차등
  - 갱신 방식: `REFRESH MATERIALIZED VIEW (CONCURRENTLY)` + 실패 시 재시도/알림

### 4.3 API 설계(초안)
- `GET /api/swms/dashboard/kpi?siteId&date`
- `GET /api/swms/dashboard/charts/flow?siteId&period`
- `GET /api/swms/dashboard/charts/sankey?siteId&periodDays=30&mode=category|material|status` (Phase 1: 간이 Flow)
- `GET /api/swms/dashboard/charts/inventory-heatmap?siteId`
- `GET /api/swms/dashboard/charts/inventory-zone-heatmap?siteId&view=capacity|aging` (Zone 고정 구획 기준)
- (Phase 2) `GET /api/swms/dashboard/charts/inventory-aging-heatmap?siteId&bucket=0-7|8-30|31+`
- `GET /api/swms/dashboard/charts/price-margin?siteId&period&materialTypeId?`
- `GET /api/swms/dashboard/charts/portfolio?siteId&period`
- `GET /api/swms/dashboard/charts/outbound-by-hour?siteId&date`
- `GET /api/swms/dashboard/work-queue?siteId&date`
- `GET /api/swms/dashboard/risk?siteId&period`
- (Phase 2) `GET /api/swms/dashboard/allbaro/status?siteId&period`

### 4.4 프론트엔드 UI(초안)
- 상단: KPI 8개 카드(드릴다운 진입점)
- 좌측: Flow Sankey + Heatmap
- 하단 좌측: 단가/마진 Line + 포트폴리오 Donut + 시간대별 반출
- 우측: 실시간 운영/작업 큐(오늘의 작업/게이트/이상 알림)
- 하단: 리스크/컴플라이언스 요약(올바로/계근편차/SLA 지연 Top)

### 4.4.1 Sankey/Heatmap 구현 상세(`docs/swms/SWMS_생키다이어그램과 히트맵 구현방안.pdf` 반영)
> 확정 입력(사용자 답변 반영): **Zone(구역) 고정 구획 = Yes**, **등급 = A/B/C**, **Sankey는 선별/보관 단계 포함 필수**

#### A) 히트맵(Heatmap): “뷰 모드 전환 + 드릴다운”을 기본안으로 채택
- 목적: “어디가 꽉 찼나(포화)”/“어디에 돈이 묶였나(장기 체화)”를 **색의 진하기**로 즉시 파악
- 기본 UX(권장: PDF 전략 1번 ‘뷰 모드 전환’):
  - `viewMode=capacity`(적재율) ↔ `viewMode=aging`(체화)
  - 구역(Zone) 클릭 → 모달/드릴다운에서 해당 구역의 “품목 매트릭스(그리드)” 상세 표시
- Phase 1(운영 우선, 고정 Zone 전제):
  - Physical Layout Heatmap(공간 기반): `swms_warehouses`를 Zone으로 사용(야적장/창고 구역) + `capacity` 기준 적재율 표시
  - Grid Heatmap(매트릭스): “품목×등급(A/B/C)” 집계로 제공(재고 집중/편중 확인)
- Phase 2(정합/확장):
  - Aging Heatmap(체화 기반): **입고일/로트 단위**로 “재고 나이(Age)” 계산이 가능해야 함(로트/이력 모델 필요)

#### B) 생키(Sankey): “노드/링크 기반 링크 테이블(또는 MV) + 기간 집계”로 구현
- 목적: 스크랩/폐기물의 **흐름(Flow)**과 **양(Quantity)**을 동시에 보여 “자원 회수율(Yield)”과 “손실/비용”을 직관적으로 표시
- 데이터 형태(필수): `source`, `target`, `value` (예: 톤) 형태의 링크 리스트
- Phase 1(선별/보관 포함, 최소 이벤트 모델 도입):
  - 권장 노드(초안): `입고` → `선별` → `보관(Zone)` → `출고(스크랩/폐기물)` → `정산(확정/대기)`
  - 분기 기준(초안): `swms_material_types.category`(또는 `is_scrap`) + `grade(A/B/C)`
  - 전제: 선별/보관을 표현하려면 “단계 전이” 기록이 필요 → `swms_process_events`(또는 `swms_inventory_movements`)를 Phase 1에 포함
- Phase 2(정합 Flow/손실까지 확장):
  - 공정 손실(Loss: 감량/분진/수분) 및 파쇄/압축 등의 세부 단계까지 확장(`loss_type`, `loss_qty` 등)

### 4.5 실시간 동기화(Phase 선택)
- Phase 1: React Query polling(예: 10~30초) + “갱신 플래시” UI
- Phase 2: WebSocket(서버 푸시) 또는 Firestore(onSnapshot) 브릿지
  - Postgres 기반인 만큼, “DB 변경 이벤트→푸시”는 별도 이벤트 레이어(트리거/큐/서버 이벤트) 설계 필요

## 5. 데이터 모델 변경(초안)
### 5.1 신설 테이블(권장)
- `swms_dispatch_plans`: 일자/현장/차량/운반사/계획중량/상태(PLANNED/IN_PROGRESS/DONE)
- `swms_work_items`: 작업 큐 표준화(유형: OUTBOUND/INSPECTION/SETTLEMENT, 우선순위, due_at, status)
- `swms_attachments`: 도메인(계근/정산 등)별 첨부(uploads 경로 또는 documents 연계 키)
- `swms_anomalies`: 이상 징후 탐지 결과(유형, 심각도, 기준값/관측값, 처리 상태)
- `swms_allbaro_sync`: 올바로 연동 상태/에러 로그/재시도 정보
- `swms_claims`: 클레임/반품/단가 재협상 등 이력(거래처/품목/기간/사유/영향금액)
- (Phase 1) `swms_process_events`(또는 `swms_inventory_movements`): 공정/단계 이벤트(선별/보관/출고/정산)와 중량 변화 기록(Sankey용)
- (Phase 2) `swms_inventory_lots`: 입고일/로트 단위 이력(체화/Aging Heatmap 및 손실 추적용)

### 5.2 기존 테이블 보강(최소안)
- `swms_inbounds/outbounds`: `grade`(A/B/C), `inspection_status`, `required_docs_status`(또는 개별 boolean)
- `swms_inventory`: 집계 키에 `grade` 포함(“품목×등급” 재고) + (선택) `lot_id` 참조(체화 대응)
- `swms_warehouses`: `capacity`, `type(INDOOR/OUTDOOR/YARD)` 등 Zone 메타데이터(Physical Layout Heatmap)
- `swms_settlements`: `invoice_issued_at`, `paid_at`, `paid_amount` 등 현금흐름 추적용 컬럼
- `swms_material_types`: `is_scrap`(또는 `category` 표준화)로 수익/비용 분리 명확화

### 5.3 병목(선별) 신호(추가 확정)
- 목적: Sankey에서 “어디가 막혔는지”를 **시간 기준**으로 판별
- 판정 기준(확정): **선별 평균 체류시간(Avg Lead Time)** ≥ 24시간이면 병목
  - 산식: `(SORT→STORAGE occurred_at) - (INBOUND→SORT occurred_at)` (단위: hours)
  - 보조: P90 체류시간(참고용)
  - 이벤트 페어링 키: `swms_process_events.meta.flowId`
- API 반영: `GET /api/swms/dashboard/charts/sankey` 응답에 `signals.sortBottleneck` 포함(avg/p90/samples/threshold/isBottleneck)
- UI 반영: 병목 시 `선별` 노드/절차 표시를 강조 + 툴팁에 평균 체류시간 표시

### 5.4 집계 뷰(Materialized View) 제안(차트 전용)
- `swms_dashboard_sankey_links_daily`: `site_id, date, mode, source, target, value_qty` (Sankey 링크)
- `swms_dashboard_inventory_zone_daily`: `site_id, date, warehouse_id(zone_id), fill_rate_pct, max_age_days` (Zone Heatmap)

## 6. 개발 단계(초안)
### Phase 1 (MVP: 2~4주 범위 권장)
- Mock 제거: `swms_analytics`를 실제 SQL 기반으로 전환
- KPI 8개 중 “가능한 항목” 우선 제공 + 미정의 항목은 “정의 필요” 배지로 노출(또는 숨김)
- 차트 3~4개 우선(시간대별 반출/포트폴리오/단가추이/간이 Flow)
- 간이 작업 큐(출고/정산) + 기본 이상 탐지(재고 음수/계근 편차)
- 집계 뷰/인덱스/성능 튜닝

### Phase 2 (정합/확장: 4~8주+)
- 배차/작업 큐 정식 모델 도입
- 정산 단계(송장/검수/세금계산서/입금) 모델링 + Aging/현금흐름 구현
- 올바로 연동(키/연계범위 확정 후)
- 증빙 갤러리(계근 이미지 스트림) + 권한/보관 정책 확정

### Phase 3 (AI: 선택)
- 이상치 탐지 고도화(차량 공차 중량 모델 등) + 설명 가능한 메시지 생성

## 7. 기본 정의/가정(초안, 추후 수정 전제)
> 아래 3가지는 “명확한 의사결정 완료”가 아니라, **현재 스키마/구현 현실을 반영한 노멀(기본) 정의**로 먼저 진행한다.  
> 추후 정책이 확정되면, 본 문서의 해당 항목과 집계 SQL/API를 수정한다.

### 7.1 “처리량” 기준(노멀 정의)
- 기본값: **입/출고 처리량(톤/중량)**은 `swms_inbounds.quantity` + `swms_outbounds.quantity` 합계로 산출한다.
- 보조값(시간대/게이트/순환율 등 “시간”이 필요한 경우): `swms_weighings.net_weight` 및 `weighing_date/time`을 우선 사용한다.
- 정합성 이슈가 생기면(단위 불일치/누락): KPI는 `in/outbounds`, 운영/시간대 차트는 `weighings`로 “용도별 분리”를 유지한다.

### 7.2 “예상/확정 매출” 정의(노멀 정의)
- 확정 매출(Confirmed): `swms_outbounds.status='SETTLED'` 또는 정산(`swms_settlements.status='CONFIRMED'`)에 포함된 출고 건의 `total_amount` 합계
- 예상 매출(Expected): `swms_outbounds.status IN ('APPROVED','PENDING')` 중 정산 미완료 건의 `total_amount` 합계
- 세금계산서/입금 기준으로 재정의가 필요하면 Phase 2에서 `swms_settlements` 보강 컬럼(예: `invoice_issued_at`, `paid_at`, `paid_amount`)과 함께 조정한다.

### 7.3 “등급/배차/정산단계” 모델링(노멀 정의)
- 등급(Grade):
  - Phase 1: 등급(A/B/C) 축을 포함한 Heatmap(“품목×등급”)을 제공한다.
  - Phase 2: 필요 시 `grade` 정규화(마스터 테이블) 및 등급 변경/클레임 워크플로우를 확장한다.
- 배차 진행률:
  - Phase 1: 배차 계획 데이터가 없으므로 KPI에서 숨김 또는 “준비중(데이터 미정)” 처리한다.
  - Phase 2: `swms_dispatch_plans` 신설 후 진행률 제공.
- 정산 지연(단계별):
  - Phase 1: “정산 미완료(전체)”만 제공(출고가 정산에 포함되지 않은 건/금액).
  - Phase 2: 단계(송장/검수/세금계산서/입금) 모델 도입 후 단계별 지연으로 확장한다.

### 7.4 추후 결정 시 수정 포인트(체크리스트)
- 처리량 기준 변경 시: KPI/차트의 집계 원천(`weighings` vs `in/outbounds` vs `generations`) 및 단위 표기
- 예상/확정 매출 재정의 시: “확정” 기준 이벤트(출고 승인/정산 확정/세금계산서/입금)와 관련 컬럼/워크플로우
- 등급/배차/정산단계 확정 시: 스키마 추가(`grade`, `dispatch`, `settlement workflow`) + Work Queue 규칙 업데이트
- Sankey 단계 확정 시: “단계(노드) 정의” 및 링크 집계 기준(입고/공정/출고/정산/폐기/손실)과 필요한 이벤트 모델 확정
- Heatmap(공간/체화) 확정 시: Zone 구획 가능 여부, Zone 용량 기준(톤/부피), 체화 기준일(입고일/최종이동일) 확정

## 7.5 변경 이력(간단 로그)
- 2025-12-15: 의사결정 대기 항목을 “노멀 정의(초안)”로 전환(추후 확정 시 수정 전제)

## 8. 기존 개발계획과의 정합성(확인 결과)
- `docs/pms/PMS_보고_개발계획.md`는 “PMS/SMS/SWMS/EMS 통합 보고(Report) 모듈” 중심의 로드맵이며, 본 문서의 “SWMS 통합 대시보드(운영 관제)”는 **보고서(문서 산출)와 다른 트랙**으로 보는 것이 안전하다.
- `docs/pms/PMS_대시보드_개발계획.md`에는 “스크랩/폐기물(리스크&수익)” 요약 영역이 포함되어 있어, 향후 PMS Executive 대시보드에서 SWMS 데이터를 집계해 보여줄 가능성이 높다.
  - 권장: SWMS 대시보드용 집계 결과(`swms_dashboard_*` Materialized View/테이블)를 **PMS 대시보드 집계 워커가 재사용**하도록 연계(중복 집계/지표 불일치 방지).
  - 연계 시나리오: PMS의 `dashboard_risks.risk_type='scrap'` 또는 유사 지표를 SWMS 집계에서 공급(상세는 `docs/pms/PMS_대시보드_DB스키마.md` 참고).
- 일정/의존성 관점에서, SWMS 대시보드 Phase 1(MVP)에서 “스크랩/폐기물 요약 지표” 정의를 확정해두면 PMS Executive 대시보드의 스크랩 영역 구현 리스크가 낮아진다.
