# PMS 공정 및 일정 관리 모듈 구현 계획 및 요구사항 (Schedule Module Plan)

## 목표 설명 (Goal Description)
무제한 계층 구조의 작업 분류 체계(WBS)를 지원하고, **간트 차트(Gantt Chart)**를 통해 직관적으로 일정을 관리하는 시스템을 구축합니다.
선행-후행 작업 간의 **의존성(Dependency) 자동 계산**을 통해 일정 지연 리스크를 사전에 파악할 수 있어야 합니다.

## 사용자 검토 필요 사항 (User Review Required)
> [!NOTE]
> **MS Project 호환성**: 기존에 현장에서 많이 사용하는 MS Project 파일(`.xml`)을 그대로 가져와서 WBS를 구성하는 기능을 필수적으로 지원해야 합니다.
> **성능 최적화**: 작업 항목이 1,000개를 초과하더라도 간트 차트 스크롤 및 렌더링에 끊김이 없어야 합니다 (Virtualization 적용 필요).

## 기능 명세 및 구현 사항 (Functional Specifications)

### 1. 데이터베이스 설계 (Database Schema)
#### [MODIFY] `tasks` (공정 마스터)
- `parent_task_id`: 계층 구조 표현 (Self-Join).
- `predecessors`: 선행 작업 ID 배열 (TEXT[] 또는 별도 테이블).
- `weight`: 가중치 (상위 작업 진척률 계산용).
- `is_milestone`: 마일스톤 여부 (간트 차트에서 다이아몬드 형상 표시).

### 2. 주요 기능 로직 (Key Features)

#### 일정 자동 계산 (Scheduling Engine)
- **로직**: 선행 작업(A) 종료일 변경 시, 연결된 후행 작업(B)의 시작일이 `A.End + 1`일로 자동 이동.
- **제약**: 순환 참조(Circular Dependency) 발생 시 저장 차단 및 경고.

#### WBS 번호 체계
- **기능**: 트리 깊이(Depth)에 따라 `1`, `1.1`, `1.1.1` 번호를 UI에서 실시간으로 계산하여 표시.

### 3. 프론트엔드 UI/UX (Frontend)

#### [MODIFY] `pms/src/pages/Schedule.tsx`
- **Split View**: 좌측 트리(Grid)와 우측 간트(Chart)의 스크롤 동기화.
- **Drag & Drop**: 간트 바를 드래그하여 일정 변경, 우측 끝을 당겨 기간 연장.
- **Zoom**: 일/주/월 단위 줌 기능.

## 검증 계획 (Verification Plan)

### 자동화/수동 테스트
1.  **Import 테스트**: 복잡한 MS Project `.xml` 파일을 업로드하여 WBS 구조가 깨지지 않고 들어오는지 확인.
2.  **의존성 테스트**: 선행 작업을 5일 뒤로 미뤘을 때, 후행 작업들도 자동으로 5일씩 밀리는지 확인.
3.  **대량 데이터**: 작업 500개 생성 후 스크롤 퍼포먼스 체크.
