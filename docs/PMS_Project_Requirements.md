# PMS 프로젝트 관리 모듈 구현 계획 및 요구사항 (Project Module Plan)

## 목표 설명 (Goal Description)
프로젝트의 전 생명주기(생성~종료)를 관리하고, 고객사 규정(Regulation) 및 보안 등급을 설정하여 하위 데이터(공정, 계약, 안전)의 기준 정보를 제공하는 **프로젝트 마스터 시스템**을 구축합니다.
단순 정보 저장을 넘어, **고객사별 프로세스 자동화(규정 템플릿)**의 기반을 마련합니다.

## 사용자 검토 필요 사항 (User Review Required)
> [!IMPORTANT]
> **보안 등급 정책**: S등급 프로젝트는 `Total Security`로 분류되어 허가된(Authorized) 인원 외에는 조회조차 불가능하도록 Row Level Security(RLS) 적용이 필요합니다.
> **고객사 규정**: 삼성/LG 외 '기타' 고객사의 경우, 기본(General) 규정을 적용하되 향후 커스텀 템플릿 추가 기능을 고려해야 합니다.

## 기능 명세 및 구현 사항 (Functional Specifications)

### 1. 데이터베이스 설계 (Database Schema)
#### [MODIFY] `projects` (프로젝트 마스터)
기존 테이블 구조를 유지하되, 일부 속성을 명확히 합니다.
- `id`: UUID (PK)
- `code`: 시스템 자동 발번 (`PRJ-24-DC-SS-001` 형식)
- `regulation_type`: 규정 템플릿 키 (SAMSUNG, LG, GENERAL)
- `security_level`: 보안 등급 (S, A, B, C)
- `status`: PREPARING, RUNNING, HOLD, COMPLETED

### 2. 주요 기능 로직 (Key Features)

#### 프로젝트 코드 자동 생성 (Auto-Numbering)
- **로직**: 연도(YY) + 공사유형(Type) + 발주처(Client) 조합 후 시퀀스(Seq) 자동 증가.
- **제약**: 사용자가 임의로 코드를 수정할 수 없음(Backend 강제).

#### 고객사 규정 템플릿 연동
- **기능**: 프로젝트 생성 시 선택한 `regulation_type`에 따라, 추후 계약/안전 모듈에서 요구하는 **필수 서류 목록**이 자동으로 결정됨.

### 3. 프론트엔드 UI/UX (Frontend)

#### [MODIFY] `pms/src/pages/Projects.tsx`
- **카드/리스트 뷰**: 프로젝트 상태(진행중, 완료 등)를 배지(Badge)로 시각화.
- **입력 폼**: PM 선택 시 검색 기능 제공, 날짜 유효성 검사(종료일 < 시작일 방지) 적용.

## 검증 계획 (Verification Plan)

### 시나리오 테스트
1.  **신규 생성**: 삼성전자 해체 공사 생성 시 코드가 `PRJ-24-DC-SS-xxx`로 생성되는지 확인.
2.  **권한 제어**: B등급 사용자가 S등급 프로젝트 접근 시 차단(또는 목록 미노출) 확인.
3.  **데이터 무결성**: 프로젝트 삭제 시도 시, 연결된 공정/계약 데이터가 있어 삭제 불가 경고가 뜨는지 확인 (Soft Delete 권장).
