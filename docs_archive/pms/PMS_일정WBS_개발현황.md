# PMS 일정/WBS 개발현황 (1차 완료, 상세)

## 1. 요구사항 정의
- 목적/범위: 프로젝트별 공정 계획(WBS), 선행관계, 일정/진행률 관리, Gantt 시각화.
- 필수 입력: 작업명, 기간(시작/종료), 부모(WBS 계층), 상태, 진행률, 선행작업(optional), 마일스톤 플래그.
- 비즈 규칙:
  - 시작 ≤ 종료, 진행률 0~100.
  - 선행작업은 동일 프로젝트 내 ID 배열, 루프/충돌 방지는 현재 수동 점검(과제).
  - 마일스톤은 기간 1일로 표현(강제 검증 미구현).
- 적용 규정: 삼성/LG 등 공정 규정은 메타 수준, 휴일/날씨 예외 미구현.

## 2. 데이터/DB
- 테이블: `tasks`
  - `project_id` FK, `parent_task_id`(계층), `name`, `start_date`, `end_date`, `progress(0~100)`,
    `status`(READY/IN_PROGRESS/DONE), `is_milestone`, `sort_order`, `predecessors`(TEXT[] WBS ID),
    `weight`, `delay_risk`.
- 특징: 선행작업은 ID 배열로 저장하고, 프런트에서 WBS 번호로 표기.

## 3. API/플로우
- 훅: `useTasks`, `useTaskMutations`(create/update/delete/clear).
- 입력/출력: `project_id`, `parent_task_id`, `name`, `start_date`, `end_date`, `progress`, `status`, `is_milestone`, `predecessors[]`, `weight`, `delay_risk`.
- 검증: 날짜 유효성만 기본 확인; 선행 충돌/캘린더 예외 검증 미구현.
- Clear: 프로젝트 단위 일괄 삭제 지원.

## 4. 프런트 구현 (`pms/src/pages/Schedule.tsx`)
- 레이아웃: 좌측 WBS 트리(접기/펼치기) + 우측 Gantt, 스크롤 동기화.
- 인터랙션: 드래그 이동/리사이즈로 기간 변경, 줌(픽셀/일) 조정, 우클릭 메뉴로 루트/하위 생성·편집·삭제.
- 모달: 선행작업을 WBS 번호 문자열로 입력 → 저장 시 ID 배열로 매핑. 진행률/기간/가중치 입력.
- 상세 패널: 선택 작업의 WBS, 기간, 진행률, 선행작업, 하위 작업 요약 표시.
- 파일 임포트: CSV/Excel 임포트 훅은 자리만, 실제 파서는 미구현.

## 5. 테스트/검증 포인트
- 계층: 다단계(WBS 1.1.1 이상) 생성 후 접기/펼치기.
- 선행: 끊긴 선행 ID 표시 여부, 순환 입력 시 차단 필요(현재 수동 점검).
- 기간: 시작/종료 입력 → Gantt 막대 위치/길이 일치, 드래그 후 저장 반영.
- 상태: DONE 설정 시 진행률 100% 유지/동기화.
- 성능: 200행 이상 스크롤/줌 응답성(브라우저) 확인.

## 6. 남은 과제
- 선행 충돌/루프 검증, 주말/휴일/날씨 캘린더 예외 처리.
- 공정 지연 시뮬레이션(슬랙/크리티컬패스) 및 리스크 표시.
- CSV/Excel 임포트·익스포트 실제 파서 추가, 다국어/타임존 대응.***
