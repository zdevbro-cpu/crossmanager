# PMS 문서 관리(Document Management) 모듈 구현 계획

## 1. 개요
본 계획서는 사용자가 정의한 "PMS – 문서관리 모듈 요구사항 정의서"를 기반으로 작성되었습니다.
모든 문서를 표준화하고, 버전 관리, 승인 워크플로우, 자동 생성, 외부 연동을 지원하는 통합 시스템을 구축합니다.

## 2. 데이터 아키텍처 전략 (Data Architecture Strategy)
본 프로젝트는 **Master-Version-Workflow 분리 모델 (MVW Model)**을 채택하여 데이터 무결성과 감사(Audit) 추적을 보장합니다.

*   **Master (`documents`)**: 문서의 고유 식별자, 불변 메타데이터(프로젝트ID, 분류) 관리.
*   **Version (`document_versions`)**: 파일의 물리적 경로, 변경 이력(Snapshot) 관리. 감사(Audit) 시점의 원본 복원 가능.
*   **Workflow (`document_approvals`)**: 승인 프로세스 상태 및 결재 이력 관리.

## 3. 데이터베이스 스키마 설계 (PostgreSQL)

### [NEW] `documents` (문서 마스터)
*문서의 고유 메타데이터와 현재 상태를 관리합니다.*
- `id`: UUID (PK)
- `project_id`: UUID (FK)
- `category`: VARCHAR(50)
    - *지원 유형: CONTRACT(계약), PROCESS(공정), SAFETY(안전), QUALITY(품질), EVIDENCE(증빙), SCRAP(폐기물), PHOTO(사진)*
- `type`: VARCHAR(100)
    - *예: 견적서, RA, 작업허가서, CheckSheet, 검사증*
- `name`: VARCHAR(255) (문서명)
- `status`: VARCHAR(20) (DRAFT, PENDING, APPROVED, REJECTED)
- `current_version`: VARCHAR(20) (예: 'v2')
- `security_level`: VARCHAR(20) (NORMAL, CONFIDENTIAL, SECRET)
- `metadata`: JSONB
    - *태그, 공정ID, 장비ID, 위치정보, AI분석결과(Phase II)*
- `review_status`: VARCHAR(20) (고객사 검토 상태)
- `created_by`: UUID (작성자)
- `created_at`: TIMESTAMP

### [NEW] `document_versions` (버전 이력)
*파일의 실제 경로와 수정 이력을 관리합니다.*
- `id`: UUID (PK)
- `document_id`: UUID (FK)
- `version`: VARCHAR(20) (v1, v2...)
- `file_path`: TEXT (저장 경로/URL)
- `file_size`: BIGINT
- `file_hash`: VARCHAR(255) (무결성 검증용)
- `change_log`: TEXT (변경 사유)
- `created_at`: TIMESTAMP

### [NEW] `document_approvals` (승인 워크플로우)
*승인 요청 및 결과를 관리합니다.*
- `id`: UUID (PK)
- `version_id`: UUID (FK)
- `approver_id`: UUID (승인자)
- `step_order`: INT (승인 순서)
- `status`: VARCHAR(20) (WAITING, APPROVED, REJECTED)
- `comment`: TEXT (반려/승인 의견)
- `signature_url`: TEXT (전자서명 이미지)
- `action_at`: TIMESTAMP

### [NEW] `document_shares` (외부 공유)
*외부 고객사 등에게 임시 공유 링크를 제공합니다.*
- `id`: UUID (PK)
- `document_id`: UUID (FK)
- `token`: VARCHAR(255) (액세스 토큰)
- `expires_at`: TIMESTAMP (만료 시간)
- `access_count`: INT (접근 횟수)
- `created_by`: UUID

## 3. 백엔드 기능 구현 (Node.js/Express)

### API 엔드포인트 구조
1.  **문서 관리 (`/api/documents`)**:
    - `POST /upload`: Multer 기반 파일 업로드. 바이러스 스캔 로직(ClamAV 연동 포인트) 포함.
    - `POST /:id/versions`: 새 버전 업로드 및 자동 버전닝(v+1).
    - `GET /`: 필터링(프로젝트, 카테고리, 태그, 기간) 및 검색.
    - `DELETE /:id`: 문서 삭제 (Soft Delete 권장).

2.  **승인 프로세스 (`/api/documents/approval`)**:
    - `POST /request`: 승인 요청 (상태 `PENDING` 변경).
    - `POST /sign`: 승인/반려 처리 (전자서명 및 `approved_at` 갱신).

3.  **자동 생성 (`/api/reports/generate`)**:
    - `POST /`: 템플릿(docx, xlsx) 기반 문서 생성.
    - **연동 로직**:
        - PMS(tasks), SMS(incidents), Scrap(weights) 데이터 조회.
        - `docxtemplater` / `exceljs`로 데이터 매핑.
        - PDF 변환(옵션) 후 `document_versions`에 자동 등록.

4.  **외부 공유 (`/api/documents/share`)**:
    - `POST /`: 만료일 설정 후 공유 링크 생성.
    - `GET /:token`: 토큰 검증 후 파일 스트림 전송.

### 보안 및 NFR 대응
- **보안**: 비밀문서(`security_level='SECRET'`)는 인가된 관리자만 접근 가능하도록 미들웨어 처리.
- **성능**: 파일 메타데이터와 태그에 인덱스 설정하여 검색 속도 최적화.

## 4. 프론트엔드 UI/UX (React)

### 페이지 및 컴포넌트
1.  **문서 대시보드 (`DocumentDetail.tsx`)**:
    - **Folder Tree**: 카테고리별 트리 구조 탐색기.
    - **File Grid**: 문서 아이콘, 상태 배지, 태그 표시.
    - **Preview Panel**: 선택 문서 미리보기 및 승인 이력 탭.

2.  **업로드 모달 (`DocumentUploadModal.tsx`)**:
    - 파일 Drag & Drop.
    - 메타데이터 입력 (문서유형, 보안등급, 관련 공정/장비 태그).

3.  **리포트 센터 (`ReportGeneratorModal.tsx`)**:
    - 리포트 종류 선택 (일일/주간/월간, 고객사 지정).
    - 데이터 미리보기 후 "생성" 버튼 클릭 시 자동 문서화.

4.  **승인 관리 (`ApprovalInbox.tsx`)**:
    - 내가 승인해야 할 문서 목록.
    - 문서 검토 및 전자서명(승인/반려) UI.

## 5. 단계별 개발 계획 (Phasing)

### Phase 1 (핵심 기능 - 금주 목표)
- [ ] DB 스키마 생성 (`documents` 계열 테이블).
- [ ] 기본 파일 업로드/다운로드 및 버전 관리 API.
- [ ] UI 문서 트리 및 리스트 조회.
- [ ] 기본 리포트(일일작업보) 자동 생성.

### Phase 2 (고도화 - 차주 목표)
- [ ] 승인 워크플로우 및 전자서명.
- [ ] 외부 공유 링크 기능.
- [ ] AI OCR 및 이미지 위험 탐지 연동(Mockup -> Actual).
- [ ] 보안 등급별 접근 제어 강화.

## 6. 완료된 구현 사항 (Implemented Features) - 2025.12.11 업데이트

### 가. 문서 관리 원칙 및 표준화 (Policies)
1.  **PDF 단일화 원칙**:
    *   프로젝트 공식 산출물은 **PDF 포맷** 저장을 원칙으로 함.
    *   사진(Image) 및 다중 파일은 PDF로 변환하여 본문과 함께 등록하도록 유도 (업로드 시 `.pdf` 제한 및 안내 문구 추가).
    *   목록 및 상세 화면에서 인쇄(Print) 기능을 우선 제공하여 공식 문서로서의 활용성 강조.
2.  **데이터 표시 원칙**:
    *   **내부 식별자(ID) 은닉**: 사용자에게는 시스템 ID(UUID) 대신 **순수 파일명(File Name)**을 주요 식별자로 제공.
    *   **파일명 유지**: 서버 저장 시 타임스탬프를 제거하고 사용자가 업로드한 원본 파일명을 유지하여 표시.
    *   **시간대(Timezone)**: 모든 생성/수정 일시는 **Asia/Seoul (KST, UTC+9)** 기준으로 변환하여 표시.

### 나. 기능 구현 내역 (Feature Details)
1.  **문서 상세 모달 (Document Detail Modal)**
    *   **헤더**: 불필요한 ID 제거, 파일명 대제목 표시, 버전 정보(Ver. x) 서브타이틀 표시.
    *   **파일 정보**: 클릭 시 새 탭에서 문서 내용을 즉시 확인할 수 있도록 링크 처리.
    *   **버전 이력 관리**:
        *   신규 버전 업로드(`+` 버튼) 및 버전 설명/번호 수동 입력 기능.
        *   **버전 삭제**: 최신 버전(Latest)에 한하여 삭제 가능 (데이터 정합성 유지).
        *   **승인 문서 보호**: 상태가 `APPROVED`인 경우 버전 삭제 및 상태 변경 불가.
2.  **문서 목록 페이지 (Documents Page)**
    *   **인쇄(Print) 기능**: 기존 다운로드 버튼 대신 **인쇄 버튼** 배치. 클릭 시 시스템 인쇄 대화상자(PDF/Image) 호출.
    *   **삭제 방지**: 승인된 문서는 목록에서 삭제 버튼을 노출하지 않음.
3.  **서버(Backend) 개선**
    *   **한글 파일명**: 업로드 시 `latin1` -> `utf8` 인코딩 변환을 통해 한글 깨짐 현상 해결.
    *   **버전 삭제 API**: 특정 버전 삭제 시 물리적 파일 제거 및 `current_version` 자동 롤백 로직 구현.
