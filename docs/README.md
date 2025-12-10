# PMS Documentation Index

본 폴더(`docs/`)는 PMS(Project Management System)의 **기획, 요구사항, 설계 문서**를 관리하는 중앙 저장소입니다.
모든 개발 및 유지보수는 본 폴더의 **최신 요구사항 정의서**를 기준으로 진행되어야 합니다.

## 1. 구현 계획 (Implementation Plans)
신규 모듈 개발을 위한 단계별 이행 계획서입니다.
- **[문서 관리 모듈 구현 계획](PMS_Document_Implementation_Plan.md)**: 계약, 안전, 공정 등 각종 문서를 통합 관리하기 위한 Phase 1/2 계획.

## 2. 요구사항 정의서 (Requirements Definitions)
각 핵심 모듈별 기능(Functional), 데이터(Data), UI 요구사항을 정의한 기준 문서(Source of Truth)입니다.
- **[프로젝트 관리](PMS_Project_Requirements.md)**: 프로젝트 생성, 코드 발번, 보안 등급 정책. (FR-PRJ)
- **[공정/일정 관리](PMS_Schedule_Requirements.md)**: WBS 체계, 간트 차트, 의존성 관리. (FR-SCH)
- **[자원 관리](PMS_Resource_Requirements.md)**: 장비/인력 마스터, 기간 배정, 중복 감지. (FR-RES)
- **[계약/견적 관리](PMS_Contract_Requirements.md)**: 견적 시뮬레이션, 계약 체결, 고객사 규정 템플릿. (FR-CON)
- **[UI 디자인 시스템](PMS_UI_Design_System.md)**: 프로젝트 공통 Tone & Manner (Color, Typo, Layout) 가이드.

## 3. 작업 내역 (Tasks)
- **[작업 체크리스트](PMS_Task_Checklist.md)**: 개발 진행 상황 추적용.
- **[현황 분석 보고서](PMS_Current_Status_Report.md)**: (2024-12-10 기준) AS-IS 시스템 분석.

## 개발 가이드 (For Developers & AI)
1. **코드 작성 전 확인**: 기능을 구현하기 전에 반드시 해당 모듈의 `_Requirements.md` 문서를 읽고 **요구사항 ID (예: FR-PRJ-01)**를 확인하십시오.
2. **문서 현행화**:기획이 변경되거나 코드가 수정될 경우, 반드시 이 문서들도 함께 업데이트하여 **코드와 문서의 불일치**를 방지하십시오.
