
# Role
너는 실용주의적인 'Senior Backend Lead'이자 'DB Modeling Expert'이다. 무조건적인 마이크로서비스 분리를 지양하고, 현재 상황에서 최적의 해답을 찾는 것을 선호한다.

# Project Status (Constraint)
나는 건설 ERP 시스템을 개발 중이며, 지난 1개월간 **PMS(공사관리) 모듈 내부에 '문서 관리 시스템'의 DB 설계와 기본 구현을 완료**한 상태다.
- **Current Situation:** 문서 관리 테이블들이 PMS 스키마 안에 존재함.
- **Constraint:** 물리적인 서비스 분리(MSA)나 DB 분리는 현재 단계에서 고려하지 않음. (기존 작업 내용을 엎을 수 없음)

# The Challenge
PMS 내부에 구축된 문서 관리 모듈이 타 모듈(SMS:안전, EMS:장비, SWMS:폐기물)의 요구사항과 대용량 데이터를 처리해야 한다.
이 **'통합 구조(Modular Monolith)'** 상태에서 다음의 복잡한 요구사항을 구현할 때 발생할 수 있는 **구체적인 구현상의 문제점**을 진단해 달라.

# The Architecture Goal (Design Intent)
나는 현재 PMS 내부에 구현된 문서 관리 기능(DB+Storage 로직)을 **논리적으로 '공통 서비스(Common/Core Module)'로 격상(Promotion)** 시키려 한다.
- **UX Requirement:** 사용자는 '공사 관리' 메뉴 하위가 아니라, **'문서 관리'라는 별도의 상위 메뉴(Top-Level)**에서 통합적으로 문서를 관리하길 원한다.
단, 이미 구현된 **'텍스트(DB)와 파일(GCS) 분리 저장 구조'는 그대로 유지**하고 싶다.

## Functional Requirements to Implement
1. **Universal Classification (범용 분류 체계):**
   - PMS DB 내의 문서 테이블이 '안전(PDCA)', '환경(폐기물)', '장비(점검)' 등 성격이 전혀 다른 타 모듈의 분류 체계를 모두 수용해야 함.
   - 출력 시 고객사(삼성/LG)별 분류 코드로 매핑까지 해야 함.
2. **Cross-Module Reference (타 모듈 참조):**
   - SMS(안전) 모듈의 `RiskAssessment` 테이블(DB)이 PMS의 `Document` 테이블을 참조(FK or Logical Ref)해야 함.
3. **High Volume Handling:**
   - 5TB 규모의 파일이 연결될 예정 (파일은 GCS 저장, DB엔 경로 저장).

# ❓ Specific Questions for Feasibility Check (검증 포인트)
현재의 PMS 통합 DB 구조를 유지한다는 전제하에, 아래 3가지 리스크에 대한 진단과 해결책(Mitigation Plan)을 제시해 달라.

1. **DB Schema Flexibility (분류 체계의 유연성):**
   - PMS 내부의 `Document` 테이블 하나로 '안전'의 복잡한 계층(Plan-Do-Check)과 '환경'의 단순 계층을 모두 커버하려면, 테이블 설계를 어떻게 가져가야 하는가? (Generic design vs JSON field 활용 등)
   - 나중에 SMS 전용 필드(예: 결재 상태, 만료일)가 추가될 때, PMS 테이블이 계속 수정(Alter)되어야 하는 '변경의 파급효과'를 어떻게 막을 수 있는가?

2. **Cross-Domain Integrity (참조 무결성):**
   - SMS(안전)에서 문서를 조회할 때, 논리적으로는 SMS 데이터지만 물리적으로는 PMS 테이블을 조회해야 한다.
   - 이때 개발자가 실수로 PMS 데이터를 삭제하면 SMS 데이터가 깨지게 되는데, 이를 방지하기 위한 DB 제약조건이나 코드 레벨의 안전장치는 무엇인가?

3. **Performance Isolation (성능 격리):**
   - 5TB 파일에 대한 다운로드 요청이나 고객사별 파일명 변환 로직(CPU 작업)이 몰릴 때, 같은 서버(Node.js Instance)를 쓰는 PMS의 핵심 기능(공정률 계산 등)이 느려지지 않게 할 **코드 레벨의 격리 전략**은 무엇인가? (예: 비동기 처리, 큐 사용 등)

4. **Schema Generic Design (범용성 확보):**
   - 현재 `Document` 테이블은 PMS 중심으로 짜여 있다.
   - 나중에 SMS(안전)나 EMS(장비)가 오픈될 때, 기존 테이블을 `DROP`하거나 대규모 `ALTER` 하지 않고도 이들을 수용하려면, **식별자(Discriminator) 컬럼이나 참조(Reference) 구조**를 지금 어떻게 잡아둬야 하는가? (예: `source_module_id`, `ref_id` 등)

5. **Metadata Flexibility (속성 확장성):**
   - PMS 문서는 '공정률'이 중요하지만, SMS 문서는 '결재선', EMS 문서는 '점검주기'가 중요하다.
   - 이 서로 다른 메타데이터를 하나의 `Document` 테이블(또는 확장 테이블)에서 효율적으로 처리하기 위한 **DB 모델링 패턴(Pattern)**은 무엇인가? (JSONB 컬럼 활용 vs 1:1 Extension Table 전략 등)

6. **Phased Launch Strategy (단계별 오픈 리스크):**
   - 1단계로 PMS와 문서 관리를 먼저 오픈하고, 3개월 뒤 SMS를 붙일 예정이다.
   - 이때 SMS 데이터가 기존 문서 관리 DB에 들어올 때, **'분류 체계(Classification)'나 '파일명 생성 규칙'의 충돌**을 막기 위해 지금 코드/DB 레벨에서 준비할 '인터페이스(Interface)' 설계는 무엇인가?

# Output Requirements
- "분리하세요"라는 말 대신, **"현재 구조에서 이 문제를 해결하려면 테이블에 컬럼을 이렇게 추가하세요"** 또는 **"API 설계를 이렇게 하세요"** 같은 실질적인 구현 가이드를 줄 것.
- 타 모듈(SMS, EMS)과의 관계를 보여주는 ERD(Entity Relationship Diagram) 구조 제안.
- 물리적인 MSA 분리 제안보다는, **현재 DB 스키마를 '공용'으로 쓰기 위한 구체적인 칼럼/테이블 설계 조언**을 줄 것.
- 텍스트(DB)와 파일(GCS) 분리 로직이 '공통 모듈'이 되었을 때의 **데이터 흐름도(Data Flow)**를 그려줄 것.