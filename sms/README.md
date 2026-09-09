# SMS (Safety Management System)

Cross 특수㈜의 안전관리(SMS) 프론트엔드입니다. PMS/EMS와 동일한 톤앤매너로 RA, DRI, 체크리스트, 패트롤, 교육/자격, 사고, 보고 자동화를 한 번에 관리합니다.

## 요구사항 맵
- RA: 공정 불러오기, 위험요소 자동 제안, 빈도×강도 계산, 예방조치, 고위험 승인, PDF 출력
- DRI: 모바일 점검, 공정+장비 기반 체크 생성, 사진/서명, 보고서 PDF
- 체크리스트: 템플릿, 실시간 체크, 필수 사진, GPS, 부적합/작업중지
- 패트롤: 루트 등록, 위험 발견, 즉시 알림, 패턴 분석
- 교육/자격: 교육 이력, 자격증/만료 관리, 30/60/90 알림, 자료 관리
- 사고: 사고/아차사고 분류, 지도 표시, 재발방지, 통계
- 보고: 고객사 양식 자동 출력, 사진 자동배치, 일/주/월 보고, 결재 프로세스

## 개발 환경
- Vite + React 19 + TypeScript, React Router v7, TanStack Query, Firebase Auth(선택)
- DB는 Google Cloud SQL/백엔드 API 사용(`VITE_API_BASE_URL`); 프론트에서는 `src/lib/api.ts`의 axios 클라이언트를 통해 접근
- `npm install` 후 `npm run dev` (Firebase 미설정 시 로컬 모드 로그인 지원)
