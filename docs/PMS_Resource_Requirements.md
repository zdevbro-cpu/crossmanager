# PMS 자원 관리 모듈 구현 계획 및 요구사항 (Resource Module Plan)

## 목표 설명 (Goal Description)
현장에 투입되는 **장비(Equipment)**와 **인력(Personnel)**을 효율적으로 배정(Allocation)하고, **중복 투입(Conflict)**을 방지하여 자원 가동률을 최적화합니다.
장비의 제원/정비 일정과 인력의 자격/보안 등급을 통합 관리합니다.

## 사용자 검토 필요 사항 (User Review Required)
> [!WARNING]
> **중복 배정 허용 예외**: 원칙적으로 중복 배정은 금지되나, 긴급 상황에서 관리자가 '강제 배정'을 해야 하는 경우가 있는지 정책 결정이 필요합니다. (현재 시스템은 단순 경고(Alert)만 표시하고 저장은 허용하는 방식 제안).

## 기능 명세 및 구현 사항 (Functional Specifications)

### 1. 데이터베이스 설계 (Database Schema)
#### [MODIFY] `resource_assignments` (배정 이력)
- `resource_type`: EQUIPMENT / PERSON 구분.
- `resource_id`: FK.
- `start_date` ~ `end_date`: 배정 기간.

#### [MODIFY] `equipments` / `personnel` (자원 마스터)
- **장비**: 규격, 관리번호, 차기 정비일 관리.
- **인력**: 보유 자격증(배열), 보안 등급 관리.

### 2. 주요 기능 로직 (Key Features)

#### 중복 감지 알고리즘 (Conflict Detection)
- **로직**: 신규 배정 요청 기간 `[S_new, E_new]`와 기존 배정 기간 `[S_old, E_old]`가 교차(Overlap)하는지 검사.
- 알림: 교차 시 `Project B`에 이미 배정됨을 알리고 기간을 표시.

#### 자원 필터링
- **필터**: `굴삭기`, `신호수` 등 역할 및 장비 유형별로 가용 자원 목록 조회.

### 3. 프론트엔드 UI/UX (Frontend)

#### [MODIFY] `pms/src/pages/Resources.tsx`
- **현황판**: 프로젝트별/자원별 배정 현황을 테이블로 표시.
- **시각화**: 중복 발생 건은 **붉은색 하이라이트** 처리.
- **조작**: 자원 선택 -> 달력에서 기간 드래그 -> 배정 완료 (2단계 UI 권장).

## 검증 계획 (Verification Plan)

### 시나리오 테스트
1.  **중복 상황 연출**: A기사를 12/1~12/5 현장A에 배정 후, 동일 기간 현장B에 배정 시도 -> **중복 경고** 발생 확인.
2.  **자격증 만료**: 자격증이 없는 인력을 특수 장비 기사로 배정 시 경고 메시지 표시 여부 확인 (추가 기능).
