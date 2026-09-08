# PMS 문서 개발현황 (1차 완료, 상세)

## 1. 요구사항 정의
- 목적/범위: 프로젝트별 문서 업로드, 버전 관리, 인쇄/삭제, 메타데이터 관리.
- 필수 입력: 프로젝트, 카테고리/타입, 문서명, 보안등급, 상태, 파일, 버전.
- 비즈 규칙:
  - 파일 최대 50MB, 한글 파일명 인코딩 보정.
  - 상태: DRAFT/PENDING/APPROVED/REJECTED, 승인된 문서는 삭제 제한.
  - 현재버전은 `documents.current_version`와 `document_versions` 동기화.
  - 보안등급 NORMAL/CONFIDENTIAL/SECRET, 접근 제어는 미구현(과제).
- 고객 규정: 삼성/LG 등 PDF 제출·버전 관리 요구 대응(전자결재/서명 미구현).

## 2. 설계 개요
- 테이블:
  - `documents`: 메타, 카테고리(CONTRACT/PROCESS/SAFETY/QUALITY/EVIDENCE/PHOTO/...), 타입, 보안등급, 현재버전, 메타데이터(JSONB).
  - `document_versions`: 버전, 파일경로, 파일크기, 해시, 변경로그, created_at.
  - `document_approvals`, `document_shares`: 승인/공유 토큰은 차기 단계.
- 파일 정책: 한글 파일명 인코딩 보정(latin1→utf8), 업로드 50MB 제한, PDF/이미지 인쇄 허용.

## 3. 백엔드 구현 (`server/routes/documents.js` -> Cloud Functions `functions/routes/documents.js`)
- **기술 스택 변경:** `Multer` -> `Busboy` (Cloud Functions/Run 호환성 및 Body Parser 충돌 해결).
- **저장소 전략:**
  - **기존:** 로컬 디스크 (`uploads/`) -> **변경:** [Firebase Cloud Storage](https://firebase.google.com/docs/storage) (`documents/{projectId}/{filename}`).
  - **임시 처리:** 업로드 중에는 `/tmp` (RAM Disk)를 버퍼로 사용 후 즉시 Storage로 전송 및 삭제.
- **다운로드/조회:**
  - DB에는 `gs://...` 또는 상대 경로 저장.
  - 조회 API(`GET /:id`) 호출 시 **Signed URL** (1시간 유효) 생성하여 반환.
- **API 변경:**
  - `POST /upload`: Busboy 스트림 처리 -> Storage 업로드 -> DB 메타데이터 저장.
  - `POST /:id/versions`: 동일 로직으로 버전 파일 처리.
- **환경 설정:**
  - CORS: `app.use(cors({ origin: true }))` 적용.
  - Storage Bucket: `crossmanager-482403.appspot.com` (환경변수 또는 하드코딩).

## 4. 프런트 구현 (`pms/src/pages/Documents.tsx`)
- **업로드 로직 변경:**
  - `Axios` -> **Native `fetch` API** (Axios의 `Content-Type: application/json` 기본값 간섭으로 인한 백엔드 파싱 에러 해결).
  - `FormData` 전송 시 브라우저가 자동으로 `boundary`를 포함한 `multipart/form-data` 헤더를 생성하도록 유도.
- **다운로드/미리보기:** 백엔드에서 받은 `downloadUrl` (Signed URL)을 통해 직접 접근.
- 리스트: 프로젝트/카테고리별 필터, 버전/상태 뱃지.
- 인쇄: PDF/이미지 Blob → iframe print.

## 5. 적용 규정/필드 예시
- (기존 동일)

## 6. 테스트/검증 포인트 & 해결 이력
- **[해결] 500 Internal Server Error (Upload):**
  - 원인: 클라이언트가 JSON 헤더를 보내고 백엔드는 Multipart를 기대함.
  - 조치: 프론트엔드 `fetch` 전환, 백엔드 `Busboy` 도입.
- **[해결] Storage Bucket Not Found:**
  - 원인: Admin SDK 초기화 시 버킷명 미지정.
  - 조치: 명시적 버킷명(`crossmanager-482403.appspot.com`) 설정.
- **[이슈] 클라우드 환경에서 파일 소실 (휘발성 저장소):**
  - 증상: 배포 시 로컬 `uploads/` 폴더 초기화로 파일 유실.
  - 1차 조치: DB(Base64) 임시 저장 (비용 이슈 존재).
  - 최종 해결 계획: Firebase Cloud Storage 마이그레이션.

## 7. 남은 과제
- **Contracts(계약/견적) 모듈 마이그레이션:**
  - 현재: DB `JSONB` 컬럼에 파일 내용(Base64 등) 직접 저장.
  - 계획: Documents와 동일하게 **Storage + Signed URL** 방식으로 통일하여 DB 용량 절감 및 성능 확보 필요.
- 승인선/서명(`document_approvals`), 외부 공유 토큰(`document_shares`) 구현.
- 보고서 자동 생성(PDF/XLSX), 파일 해시로 중복 차단.

### 2023-11-XX (문서 관리 고도화)
- **프론트엔드 (UI/UX)**
  - **문서 업로드:** "문서명(공식)"과 "파일명(물리)" 구분 입력 UI 완성.
  - **문서 상세:** 수동 버전 입력 필드(예: v1.1) 추가, 상태 변경(Select) UI 복구.
  - **파일 접근:** Signed URL 사용 전면화로 `Cannot GET` 및 404 에러 해결.
  - **목록 화면:** "문서명" 헤더를 "**프로젝트 산출물**"로 변경, 인쇄(다운로드) 버튼 클릭 시 최신 Signed URL을 받아오도록 로직 개선.

- **백엔드 (Firebase Functions)**
  - **버전 API:** `POST /versions`에서 사용자 정의 `version` 파라미터 수신 (미제공 시 자동 증가).
  - **Storage:** 파일 업로드 및 Signed URL 생성 로직 안정화.

### 2023-11-XX (문서 관리 고도화 2단계)
- **프론트엔드 (UI/UX)**
  - **문서 상세 모달:** 파일명 표시 시 타임스탬프 제거, 보안 등급 수정 기능 추가.
  - **목록 화면:** 프로젝트 컬럼 삭제 후 산출물명 하단 병기, 컬럼 순서 재배치.
  
- **백엔드 (Firebase Functions)**
  - **문서 수정 API:** `PATCH /documents/:id` 구현 (Status, Security Level 통합 수정).

## 8. 2025-12 저장소 최적화 및 UI 개선 계획

### **1. 저장소 이전 (Local Server -> Firebase Cloud Storage)**
> **현황 발견:** 배포된 Cloud Functions(`functions/`)에는 이미 **Firebase Storage** 업로드 로직이 구현되어 있어 파일이 정상적으로 저장되고 있었음.
> **문제점:** 로컬 개발 서버(`server/`)는 아직 DB/Disk 방식을 사용 중이라 환경 불일치 발생.
- **백엔드 수정 (`server/`):**
  - 로컬 서버 코드도 `functions/`와 동일하게 **[Firebase Cloud Storage](https://firebase.google.com/docs/storage)**를 사용하도록 마이그레이션.
  - `Multer` -> `Busboy`로 파서 변경 (Cloud Functions 호환성 확보).
  - DB에는 파일 내용(`file_content`) 대신 경로(`documents/...`)만 저장.
  - **[해결됨] 배포 서버 파일 404 원인:** 배포된 Cloud Functions는 **Serverless(임시 실행 환경)**이므로, 로컬 PC에 저장된 파일(`server/uploads/...`)을 가지고 있지 않음. 따라서 배포 시 로컬 경로는 유효하지 않게 되어 파일을 찾을 수 없었음. 이를 해결하기 위해 모든 파일을 중앙(Firebase Storage)에 저장하고 스트리밍하도록 변경함.
- **프론트엔드 수정:**
  - 특별한 변경 없음.

### **2. UI 개선: 보안 등급 가시성 확보**
- **목록 화면:**
  - 보안등급 `SECRET`, `TOP_SECRET` 등: 문서명 옆 **자물쇠 아이콘(🔒)** 표시.
- **Context Menu:**
  - 우클릭 메뉴에 '보안등급: [등급]' 정보 추가.

### 2025-12 (인쇄 기능 및 UI 완성도 향상)
- **인쇄 기능 개선 (Print Functionality):**
  - **문제:** 기존 인쇄 요청 시 파일 미리보기(PDF 뷰어) 창에서 멈추거나 시스템 인쇄 대화상자가 뜨지 않는 현상.
  - **해결:** `Contracts`(계약) 페이지의 검증된 로직(Blob Fetch -> New Window -> Auto Print)을 `Documents` 페이지에 이식.
  - **Auto Close:** 인쇄 완료(또는 취소) 시 미리보기 창이 활성화를 잃었다가 다시 얻는(Blur/Focus) 시점을 감지하여 자동으로 팝업 창을 닫는 로직 구현.
- **UI 개선:**
  - **Context Menu:**
    - '인쇄 / 다운로드' -> '**인쇄**'로 명칭 단일화.
    - '**보안등급**' 정보를 메뉴 최상단으로 이동 및 명칭 변경.
    - '**파일명 변경**' 기능 추가 (상세 모달 내부 버튼 삭제 후 우클릭 메뉴로 통합).
    - '새 버전 업로드' 메뉴에서 불필요한 버전 번호(v1 등) 표시 제거.
  - **Header:** 불필요한 가이드 텍스트('(폴더 생성 : 우클릭)') 삭제 및 간결화.
- **백엔드 (Backend):**
  - **파일 스트리밍:** `docview` 라우트에서 파일 데이터를 효율적으로 스트리밍하도록 로직 개선, Firebase Storage 및 로컬 파일 시스템 호환성 강화.

### 2025-12-12 (개발 환경 동기화 이슈)
- **증상:** Git Pull 이후 `SystemChecklist` 데이터 조회 불가 및 템플릿 기능 작동 안함.
- **원인:**
  - 집(Home) 작업분이 커밋될 때 백엔드 API(`checklist-templates`) 및 DB 테이블 생성 로직이 누락되었거나, 프론트엔드가 Mock Data 상태로 남아있었음.
  - `git pull` 이후 Node.js 서버 프로세스를 재시작하지 않아 구버전 코드가 메모리에 상주함.
- **조치:**
  - **Server:** `sms_checklist_templates` 테이블 생성 쿼리 및 CRUD API(`GET/POST/PUT/DELETE`) 구현 추가.
  - **Client:** `SystemChecklist.tsx`의 Mock Data 제거 및 실제 API(`axios`) 연동.
  - **Process:** Node.js 서버 프로세스 강제 종료 후 재시작하여 정상화.

### 2025-12-12 (Firebase 인증 및 파일 저장소 이슈)
- **증상:** 문서 업로드 시 `500 Error: Could not load the default credentials`.
- **원인:** 사무실 개발 환경에 Google Cloud Service Account Key 파일이 없어 Firebase Storage 접근 불가.
- **조치:**
  - `server/routes/documents.js`: Storage 업로드 실패(인증 에러 등) 시 **Local Disk(`uploads/`)**에 파일을 유지하도록 Fallback 로직 구현.
  - **주의:** 로컬에 임시 저장된 파일은 **자동으로 Cloud Storage로 동기화되지 않음**. 추후 키 파일 확보 후 별도 마이그레이션 스크립트 실행이 필요함.

### 2025-12-12 (UX 개선: 문서 업로드 및 상세)
- **문서 업로드:** 파일 선택 시, 파일명(확장자 제외)을 문서명 필드에 자동 입력하는 편의 기능 추가 (입력란이 비어있을 경우).
- **문서 상세:** 문서명과 파일명 중복 표시를 개선하여, 첨부파일 영역은 "파일 보기"로 간소화(파일명은 툴팁으로 제공).
- **문서 업로드:** 보안 등급 선택 필드 추가 (기본값: NORMAL, UI: 문서 종류와 2열 배치).
