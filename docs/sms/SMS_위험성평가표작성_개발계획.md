# SMS 위험성평가 고도화 개발 계획 (Phased Approach)

## 1. 개요 (Overview)
본 문서는 SMS(Smart Management System)의 위험성평가(Risk Assessment) 기능을 고도화하기 위한 단계별 개발 계획입니다. 대량의 표준 데이터(`riskTemplates.ts`)를 효율적으로 관리하고, 향후 인공지능(AI) 기반의 지능형 추천 시스템으로 확장하기 위해 **단계적(Phased) 접근 방식**을 채택합니다.

## 2. 개발 전략: 단계적 접근 (Phased Approach)

### [Phase 1] Standard DB 구축 (기반 확보)
- **목표**: 정적 파일(`riskTemplates.ts`)을 관계형 데이터베이스(Standard DB)로 이관하여 데이터 관리 체계를 확립하고, 기존 조회/작성 UI를 API 기반으로 전환.
- **핵심 가치**: 데이터 무결성 확보, 법적/표준 안전 수칙 준수, 클라이언트 최적화.
- **기술 스택**: PostgreSQL (or Cloud SQL), REST API.

### [Phase 2] RAG & AI 검색 도입 (지능화)
- **목표**: 구축된 Standard DB 데이터를 벡터화(Embedding)하여 자연어 검색 및 AI 추천 기능 구현.
- **핵심 가치**: 사용자 경험(UX) 극대화 (복잡한 검색 과정 없이 상황 묘사만으로 항목 추출).
- **기술 스택**: Vector DB (pgvector or Pinecone), OpenAI API (Embedding/LLM).

---

## 3. 상세 개발 내용 (Phase 1 중심)

### 3.1. Standard DB 스키마 설계
기존 JSON 데이터를 수용하면서도 향후 검색 확장이 용이한 구조로 설계합니다.

| 필드명 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | Primary Key |
| `construction_type` | String | 공종 (Index 적용) |
| `step` | String | 작업단계 |
| `risk_factor` | String | 위험 요인 |
| `risk_factor_detail` | String | 위험 요인 상세 |
| `risk_level` | Enum | 위험성 등급 (상/중/하) |
| `measure` | String | 감소 대책 |
| `residual_risk` | Enum | 잔여 위험성 (상/중/하) |
| `embedding` | Vector | (Phase 2 예정) AI 검색을 위한 벡터 데이터 |

### 3.2. 데이터 마이그레이션 (Seeding)
- **대상**: `src/data/riskTemplates.ts` (약 1.4만 라인).
- **작업**:
    1. 중복 데이터(Duplicates) 제거 및 정제.
    2. 공종(`construction_type`)별 분류 및 DB 적재 스크립트 작성 (`seed_risk_standards.ts`).

### 3.3. 백엔드 API (Backend)
- `GET /api/sms/risk-standards`:
    - 필터: 공종, 작업단계 등.
    - 기능: 표준 아이템 목록 반환.

### 3.4. 프론트엔드 (Frontend)
- **RiskAssessmentEditor 리팩토링**:
    - 거대한 정적 파일 `import` 제거.
    - API 호출(`useQuery`)을 통한 데이터 동적 로딩.
    - '공종 선택' -> '작업단계 필터' UX 유지 (데이터 소스만 변경).

---

## 4. 기대 효과
1.  **성능 개선**: 프론트엔드 번들 사이즈 약 500KB 감소 및 초기 로딩 속도 향상.
2.  **유지보수 용이**: 표준 데이터 수정 시 재배포 없이 DB 업데이트만으로 반영 가능.
3.  **확장성**: Phase 2 진입 시, 별도의 데이터 재구축 없이 `embedding` 컬럼 추가 및 인덱싱만으로 RAG 시스템 도입 가능.
