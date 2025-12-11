# PMS 문서 가이드

PMS(Project Management System) 문서를 한 곳에서 찾고, **요구사항 → 설계 → 구현 → 현황** 흐름으로 읽을 수 있도록 정리했습니다.

## 문서 위치
- 루트(`docs/`): 요구사항·체크리스트
  - `PMS_Project_Requirements.md`
  - `PMS_Schedule_Requirements.md`
  - `PMS_Resource_Requirements.md`
  - `PMS_Contract_Requirements.md`
  - `PMS_Document_Implementation_Plan.md`
  - `PMS_Current_Status_Report.md`
  - `PMS_Task_Checklist.md`
- `pms/`: 모듈별 개발현황
  - `PMS_프로젝트_개발현황.md`
  - `PMS_일정WBS_개발현황.md`
  - `PMS_자원_개발현황.md`
  - `PMS_계약견적_개발현황.md`
  - `PMS_문서_개발현황.md`
- `UI_Design.md`: PMS UI 공통 디자인 가이드(톤앤매너, 컬러, 컴포넌트 규칙)

## 추천 읽기 순서
1) `pms/` 개발현황 문서로 완료/미완료 포인트 파악  
2) `PMS_*_Requirements.md`에서 상세 스펙 확인  
3) `PMS_Document_Implementation_Plan.md`와 체크리스트로 잔여 작업 검토  
4) UI 구현 시 `UI_Design.md`를 참고해 스타일을 통일

## 작성/업데이트 규칙
- 단일 출처: 요구사항/스키마/플로우는 `PMS_*_Requirements.md`에 기록, 다른 문서는 경로만 참조.
- 용어 일관성: 코드/DB/문서 동일 명칭 사용(예: PREPARING/RUNNING/COMPLETED, EST/CONTRACT/CHANGE).
- 시간/형식: 날짜 `YYYY-MM-DD`, 타임존 Asia/Seoul 기준.
- 상태/버전: 문서·계약·작업 상태 값은 테이블 정의 그대로 대문자로 표기.

## 다음 액션
- Verification 단계(`PMS_Task_Checklist.md`)를 진행하며 테스트 케이스를 보강하십시오.
- 문서관리 모듈의 승인/공유/리포트는 2차 범위이며, 설계 초안은 `pms/` 개발현황 문서에 연결되어 있습니다.

## ?? ??
- 2025-12-11: `firebase deploy --only "functions,hosting" --project crossmanager-1e21c` ?? (Hosting: dist_all ??? ??, Functions: ?? ?? ??). Functions ????? ?? .env ??(DB_HOST/DB_USER/DB_PASSWORD/DB_NAME ?) ?? ??.

## ?? ??
- 2025-12-11: `firebase deploy --only "functions,hosting" --project crossmanager-1e21c` ?? (Hosting ?? dist_all ??, Functions ?? ?? ??). ?? ?? ? Cloud SQL ??(`/cloudsql/crossmanager-480401:asia-northeast3:crossmanager`) ?? ??? ??? ?????, 1e21c ???? ????? INSTANCE_CONNECTION_NAME/DB_USER/DB_PASSWORD/DB_NAME ?? ?? ?? ??? ?? ???? ??? ?? ??.
