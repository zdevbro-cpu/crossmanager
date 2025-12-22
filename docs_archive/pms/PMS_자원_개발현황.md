# PMS 자원 개발현황 (1차 완료, 상세)

## 1. 요구사항 정의
- 목적/범위: 인력/장비 마스터, 프로젝트별 배치(기간/상태) 관리.
- 필수 입력:
  - 마스터: 이름, 코드(장비), 역할/자격/보안등급(인력), 상태.
  - 배치: 프로젝트, 자원타입, 자원ID, 시작/종료일, 상태.
- 비즈 규칙:
  - 기간 필수, 시작 ≤ 종료.
  - 동일 자원 중복 기간은 경고(프런트), 서버 차단 미구현.
  - 보안/자격 정보는 문자열 메타만 저장, 증빙 파일 업로드는 미구현.

## 2. 데이터/DB
- `equipments`: `name`, `code`(uniq), `type`, `spec`, `location`, `status`(AVAILABLE/IN_USE/MAINTENANCE), `maintenance_due_date`.
- `personnel`: `name`, `role`(OPERATOR/WORKER/MANAGER), `qualifications`(TEXT[]), `security_clearance`, `status`.
- `resource_assignments`: `project_id`, `resource_type`(EQUIPMENT/PERSON), `resource_id`, `start_date`, `end_date`, `status`(PLANNED/ACTIVE/COMPLETED).

## 3. API/플로우
- 훅: `useResources` 조회, `useResourceAssignmentMutations` 생성/삭제.
- 입력/출력: 위 테이블 필드 그대로 사용, 날짜 `YYYY-MM-DD`.
- 검증: 기간 필수, 중복 겹침 서버 차단 없음(프런트 경고만). 가용률/비용 필드 없음.

## 4. 프런트 구현 (`pms/src/pages/Resources.tsx`)
- 리스트: 배치된 자원만 표시, 인력/장비 탭 분리.
- 겹침 계산: `computeConflicts`로 기간 교집합 계산 후 `MM.DD (~일)` 포맷으로 표시.
- 배치 생성: 자원 선택 + 기간 입력 → 생성. 삭제는 행 단위.
- 인력 소스 통합: Users + Personnel을 하나의 드롭다운으로 병합하여 PM/작업자를 선택.
- 날짜 포맷: `formatDate`, `formatShortDate`로 TZ 보정 후 YYYY-MM-DD / MM.DD 표기.

## 5. 테스트/검증 포인트
- 겹침: 동일 자원에 중복 기간 입력 → 경고 리스트 노출.
- 상태: PLANNED → ACTIVE → COMPLETED 전환 시 표시/정렬 확인(상태 필터 미구현).
- 코드 중복: 장비 코드 UNIQUE 제약 동작 확인.
- TZ: 저장 후 재로딩 시 날짜 하루 밀림 없는지 검증.

## 6. 남은 과제
- 서버 측 중복 배치 차단 및 가용률 계산, 비용(일/주 단가) 필드 추가.
- WBS 연계 뷰(공정별 필요 자원 vs 배치)와 대체 자원 추천.
- 보안/자격 증빙 업로드 및 유효기간 알림.***
