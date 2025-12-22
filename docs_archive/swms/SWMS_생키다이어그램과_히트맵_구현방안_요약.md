# SWMS 생키 다이어그램·히트맵 구현방안 요약

원문: `docs/swms/SWMS_생키다이어그램과 히트맵 구현방안.pdf`

## 1) 히트맵(Heatmap) 3가지 표현 방식

### 1. 공간 기반 히트맵(Physical Layout Heatmap)
- 질문: “야적장/창고의 어느 구역(Zone)이 꽉 찼는가?”
- 축/색상: 구역(Zone) × 적재율(fill rate, capacity %)
- 운영 효과: 지게차/현장 관리자가 “어느 구역을 비우고 어디로 옮길지”를 즉시 판단

### 2. 매트릭스 히트맵(Grid Heatmap)
- 질문: “어떤 품목/등급의 재고가 가장 많이 쌓여있는가?”
- 축/색상: 품목/등급(또는 품목/월) × 재고량(톤)
- 운영 효과: 특정 품목/등급 집중 적재를 빠르게 발견(예: “철만 과다 적재”)

### 3. 장기 체화 재고 히트맵(Aging Heatmap) (추천)
- 질문: “돈이 묶여 있는(오래된) 재고는 어디 있는가?”
- 색상 기준: 입고 후 경과 일수(Age, DIO)
- 운영 효과: 우선 처리 대상(예: 30일 이상)을 강조해 현금흐름/품질저하 리스크 관리

## 2) 히트맵 UX 제안(권장)
- **뷰 모드 전환(viewMode)**: `capacity`(포화) ↔ `aging`(체화)
- **드릴다운**: 구역(Zone) 클릭 → 모달에서 해당 구역의 상세(품목 매트릭스/체화 데이터) 표시

## 2.1) 본 프로젝트 확정사항(반영)
- Zone(구역)은 고정 구획(야적장/창고 구역 기반)
- 등급은 A/B/C 구분을 사용
- Sankey는 선별/보관 단계를 포함해야 함

## 3) 생키 다이어그램(Sankey) 핵심 요약
- 목적: 흐름(Flow)과 양(Quantity)을 동시에 표현(선 두께=값)
- 장점: 병목/손실/비중을 직관적으로 파악(자원 회수율, 폐기 비용 비중 등)
- 주의: 노드가 많아지면 복잡(“스파게티”) → 단계 수를 제한하고 드릴다운 권장
- 데이터 구조: `source`, `target`, `value` 형태의 링크 리스트(노드/링크)

### 3.1) 선별 병목(Phase 1.5) 판단 기준(확정)
- 병목 판정 기준: **선별 평균 체류시간(Avg Lead Time)** 기준
  - 산식(이벤트 기반): `선별 체류시간(hours) = (SORT→STORAGE occurred_at) - (INBOUND→SORT occurred_at)`
  - 기준값(기본): **24시간 이상이면 병목**
  - 보조지표: P90 체류시간(참고용)
- 구현 메모:
  - 이벤트 페어링을 위해 `swms_process_events.meta.flowId`로 동일 흐름을 묶어 체류시간을 계산
  - API(`GET /api/swms/dashboard/charts/sankey`) 응답에 `signals.sortBottleneck`(avg/p90/samples/threshold/isBottleneck)를 포함
  - UI는 선별 노드를 강조(병목 시)하고, 툴팁에 평균 체류시간을 표시

## 4) SWMS 적용 예시(문서 내 시나리오)
- 월간 100톤 발생 → 철/비철/폐기물로 1차 분기 → 매각/소각/매립으로 최종 처분
- 관리 포인트:
  - 자원 회수율(Yield) 시각화(수익 흐름 vs 비용 흐름)
  - 손실(Loss: 감량 등) 분기/추적(가능 시)
  - 공정 단계별 중량 변화(가능 시)

## 5) 배포/데모 환경 샘플데이터
- 배포 서버에서 `Market data is empty` 또는 KPI가 전부 0으로 보이면, **샘플 데이터가 없는 상태**일 수 있음
- 샘플 시드 실행(서버 환경에서 1회):
  - `node Server/seed_swms_dashboard_sample.js --siteId=<현재 선택된 siteId>`
  - 또는 환경변수로 지정: `SWMS_SITE_ID=<siteId> node Server/seed_swms_dashboard_sample.js`
- 참고: SWMS의 `siteId`는 프론트에서 `SiteContext`가 선택한 값이며, 대시보드 API 호출의 `siteId`와 동일

### 5.1) 배포 환경 진단(0 데이터/연계 불가)
- 서버에서 아래 엔드포인트로 “해당 siteId에 데이터가 있는지”를 바로 확인 가능:
  - `GET /api/swms/dashboard/debug/summary?siteId=<siteId>`
- `distinctSiteIds`에 나오는 값과 현재 UI가 쓰는 `siteId`가 다르면 **siteId 불일치**(가장 흔한 원인)
