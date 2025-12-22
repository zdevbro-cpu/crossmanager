# PMS 보고서 자동 변환 및 고객사 템플릿 대응 기술 제안

## 1. 개요
현재 PMS에 저장된 표준화된 보고서 데이터(JSON)를 고객사(삼성, LG, SK 등)별로 상이한 Excel/PDF 양식에 맞춰 자동으로 변환하여 출력하는 기능에 대한 기술적 구현 방안입니다.

## 2. 핵심 요구사항
- **데이터 매핑:** PMS의 표준 데이터(공정률, 투입인원, 금일실적 등)를 고객사 양식의 특정 셀(Cell) 위치에 매핑.
- **양식 보존:** 고객사가 제공한 양식(매크로, 결재란, 로고 등)을 그대로 유지한 채 데이터만 채워 넣어야 함.
- **확장성:** 새로운 고객사나 양식이 추가될 때 코드 수정을 최소화.

## 3. 아키텍처 제안 (Backend 중심)

### A. Strategy Pattern (전략 패턴) 적용
보고서 생성 로직을 캡슐화하여 고객사별로 별도의 전략 클래스를 구현합니다.

```typescript
// Interface
interface ReportStrategy {
    generate(data: ReportData): Promise<Buffer>; // 엑셀 또는 PDF 바이너리 반환
}

// Implementations
class SamsungF1Strategy implements ReportStrategy { ... }
class LGEnergyStrategy implements ReportStrategy { ... }
class SKHynixStrategy implements ReportStrategy { ... }

// Factory
class ReportStrategyFactory {
    static getStrategy(customerType: string): ReportStrategy {
         if (customerType === 'SAMSUNG') return new SamsungF1Strategy();
         // ...
    }
}
```

### B. 템플릿 엔진 활용 (ExcelJS / SheetJS)
- **방식:** 빈 엑셀 파일 생성이 아닌, **"기존 양식 파일(.xlsx)을 로드하여 데이터만 주입"**하는 방식 채택.
- **라이브러리:** Node.js 환경에서 `exceljs`를 추천합니다. (스타일 및 이미지 보존 우수)
- **Template Repository:** 서버 스토리지에 고객사별 빈 양식 파일(`template_samsung_v1.xlsx`)을 관리.

### C. 매핑 설정 (Mapping Configuration)
하드코딩을 피하기 위해, 데이터와 엑셀 셀의 매핑 정보를 별도 JSON으로 관리할 수 있습니다.

```json
// mapping_samsung.json
{
    "project_name": "B2",
    "date": "G4",
    "weather": "I4",
    "worker_count": "C15",
    "today_work": { "startRow": 20, "col": "B" } 
}
```

## 4. 프론트엔드 (UI) 흐름
1. **리포트 뷰어/목록**: [내보내기(Export)] 버튼 추가.
2. **모달 팝업**: 변환할 양식 선택 (프로젝트 정보 기반 자동 추천).
   - 예: "삼성전자 P3 양식으로 변환하시겠습니까?"
3. **다운로드**: 서버에서 생성된 Stream을 받아 Blob으로 변환 후 다운로드Trigger.

## 5. 단계별 도입 계획
1. **Phase 1 (파일럿):** 가장 사용 빈도가 높은 1개 양식(예: 주요 현장 일보)에 대해 하드코딩 방식으로 구현하여 검증.
2. **Phase 2 (엔진화):** `ReportGenerator` 클래스 및 템플릿 로딩 구조 구축.
3. **Phase 3 (Admin):** 관리자 페이지에서 엑셀 양식을 업로드하고 셀 매핑을 정의할 수 있는 기능(No-Code/Low-Code) 개발.

## 6. 결론
이 기능을 구현하면 현장 관리자가 이중으로 문서를 작업하는 수고를 100% 제거할 수 있어 PMS 도입의 가장 큰 유인책(Killer Feature)이 될 것입니다. 우선순위를 높여 진행하는 것을 권장합니다.
