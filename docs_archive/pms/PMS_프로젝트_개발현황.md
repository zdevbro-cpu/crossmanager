# PMS 프로젝트 개발현황 (1차 완료, 상세)

## 1. 요구사항 정의
- 목적/범위: 프로젝트 식별 및 코드 부여, 규정/보안/PM/기간 관리, 타 모듈(계약/일정/자원/문서) FK 기준점.
- 필수 입력: 이름, 공사코드, 고객코드, 규정타입, 보안등급, 상태, 기간(시작/종료), PM.
- 비즈 규칙
  - 코드 자동생성: `PRJ-YY-{공사코드}-{고객코드}-{SEQ}` (Prefix 내 SEQ 증가).
  - 날짜: 시작 ≤ 종료. 역전 시 저장 차단.
  - 규정/보안: 정의된 옵션만 사용(서버 검증은 미구현 → 과제).
- 고객 규정 옵션: 삼성(기본), LG, SK, 현대·GS·쌍용, 플랜트/화공, 국내공사, 기타.

## 2. 데이터/ERD 요약
- 테이블 `projects`
  - `id(UUID PK)`, `code(UNIQUE)`, `name`, `client`, `address`, `start_date`, `end_date`,
    `security_level`, `pm_name`, `regulation_type`, `status`, `created_at`, `updated_at`.
  - 기본값: `security_level='보통'`, `status='PREPARING'`.
- 연계 FK: `contracts.project_id`, `tasks.project_id`, `resource_assignments.project_id`, `documents.project_id`.
- 인덱스 제안: `code UNIQUE`, `regulation_type`, `status`, `start_date`.

## 3. API/플로우
- REST: `/projects` POST(생성), PUT(수정). DELETE 미구현(클라이언트 소프트 삭제만).
- 입력/출력 필드: 위 테이블 동일. 날짜는 `YYYY-MM-DD`.
- UI 플로우 (`pms/src/pages/Projects.tsx`)
  1) 공사코드/고객코드 선택 → `generatedCode` 프리뷰.
  2) 이름/기간/보안/규정/PM 입력 → 생성.
  3) 테이블에서 선택 → 상세 편집 → 저장.
  4) 삭제 클릭 → 클라이언트에서만 목록 제거(서버 미연동 안내).

## 4. 구현 디테일
- 코드 생성: `useMemo` + `nextSeqForPrefix`로 Prefix 내 SEQ+1 산출.
- 검증: `validateDateRange`로 시작>종료 시 토스트 경고 후 차단.
- PM 선택: `usePersonnel` + Users 병합 드롭다운, 로딩 상태 처리.
- 옵션: 규정/보안/상태 고정 셀렉트, 서버에 문자열 그대로 저장.
- 삭제: 소프트(클라이언트)만 존재 → API 필요.

## 5. 테스트/검증 시나리오
- 코드 충돌: 동일 Prefix 3건 연속 생성 → `001,002,003` 순서 확인.
- 날짜 역전: 시작>종료 입력 시 저장 차단 및 경고 토스트 노출.
- 규정 전파: Contracts 화면에서 `regulation_type` 템플릿 자동 매칭 확인.
- FK 필터: 생성된 `project_id`로 계약/일정/자원/문서 필터 동작 확인.

## 6. 남은 과제
- DELETE API + 복구 정책(Soft delete vs archive).
- 보안등급/규정 타입 공통 상수화(서버·프런트 공유 모듈).
- 고객 규정별 체크리스트(계약/안전/품질) 자동 로드·검증.
