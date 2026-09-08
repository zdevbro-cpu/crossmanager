# Claude & Human Collaboration Plan: DMS Project

이 문서는 사용자(Architect/Lead)와 클로드(Implementation Specialist)가 **DMS(Document Management System)** 구축 및 고도화 작업을 효율적으로 수행하기 위한 협업 가이드를 정의합니다.

## 1. 역할 정의 (Roles & Responsibilities)

| 주체 | 역할 | 주요 책임 |
| :--- | :--- | :--- |
| **사용자 (Lead)** | Decision Maker | 요구사항 정의, 아키텍처 승인, 코드 리뷰 및 최종 의사결정 |
| **클로드 (AI)** | Implementation | 코드 구현, 기술 분석, 테스트 자동화, 문서화 및 리스크 탐색 |

## 2. 협업 워크플로우 (Collaboration Workflow)

### 2.1 이슈 해결 단계 (Problem Solving)
1.  **Context Sharing:** 사용자가 현재 작업 중인 파일이나 요구사항을 공유합니다.
2.  **Implementation Plan (Claude):** 클로드가 변경 사항에 대한 구체적인 로직과 계획을 제안합니다.
3.  **Refinement:** 사용자의 피드백을 반영하여 계획을 수정합니다.
4.  **Execution (Claude):** 확정된 계획을 바탕으로 코드를 직접 수정하거나 새로운 로직을 구현합니다.
5.  **Validation:** 클로드가 테스트 코드를 작성하거나 실행 결과를 보고합니다.

### 2.2 코드 작성 및 수정 원칙
-   모든 코드는 기존 프로젝트의 **디자인 시스템 및 코딩 컨벤션**을 철저히 준수합니다.
-   **TypeScript**를 기반으로 한 강력한 타입 정의를 우선시합니다.
-   범용적으로 사용될 **Common Module(DMS)**의 경우, 특정 도메인에 종속되지 않도록 설계합니다.

## 3. DMS 구축 단계별 로드맵 (Project Roadmap)

### Phase 1: 기초 설계 및 DB 스키마 고도화
*   [ ] `implementation_plan.md`의 설계를 기반으로 한 `documents`, `document_versions`, `category_mappings` 테이블 구조 확정.
*   [ ] Soft Delete 및 Namespace 기반의 분류 체계(Module Namespace) 적용.
*   [ ] 초기 DB Migration 스크립트 작성.

### Phase 2: DMS Core API 개발
*   [ ] GCS Signed URL 기반의 파일 업로드/다운로드 공통 로직 구현.
*   [ ] 파일명 생성 규칙(Naming Provider) 인터페이스화.
*   [ ] 문서 메타데이터 관리를 위한 Generic JSONB 필드 처리 로직.

### Phase 3: 모듈별 통합 (Integration)
*   [ ] **PMS:** 기존 파일 관리 로직을 DMS로 이전 (Migration).
*   [ ] **SMS/EMS:** 신규 모듈에 DMS 통합 및 연동.
*   [ ] Cross-Domain 참조를 위한 `document_links` 연계.

### Phase 4: UI/UX 연동 패키징
*   [ ] 프론트엔드 공통 DMS 컴포넌트(파일 업로더, 브라우저) 라이브러리화.
*   [ ] 프로젝트 전반에 걸친 일관된 디자인 시스템 적용 (TailwindCSS/Shadcn UI 등 활용).

## 4. 리스크 관리 (Risk Management)

-   **데이터 정합성:** PMS 데이터 이전 시 데이터 유실 방지를 위한 검증 로직 필수.
-   **성능:** 대용량 파일 목록 조회 시 인덱싱 및 캐싱 전략(Redis 등) 고려.
-   **보안:** GCS Signed URL의 유효 기간 및 권한 제어 철저.

## 5. 소통 도구 및 방식

-   **Artifacts:** 클로드는 주요 아키텍처, 계획, 복잡한 로직을 Artifact를 통해 시각적으로 보고합니다.
-   **Markdown Progress:** `docs/dms/progress.md` 파일을 통해 작업 진척도를 수시로 기록합니다.
-   **Git Workflow:** 모든 변경 사항은 `/git_sync_full` 및 `/git_push` 워크플로우를 활용하여 안전하게 관리합니다.

---
**다음 단계 (Next Steps):**
위 계획에 동의하시면, **Phase 1의 DB 스키마 확정 및 Migration 스크립트 작성**부터 착수하겠습니다.
