export type Requirement = {
  id: string
  title: string
  detail: string
  tags?: string[]
}

export const riskAssessmentRequirements: Requirement[] = [
  { id: 'RA-01', title: '공정 선택', detail: 'PMS 공정 불러오기' },
  { id: 'RA-02', title: '위험요소 자동 제안', detail: '공정 기반 위험 자동 추천' },
  { id: 'RA-03', title: '위험도 계산', detail: '빈도×강도 자동 산정' },
  { id: 'RA-04', title: '예방조치 입력', detail: '조치 내용 기록 및 추적' },
  { id: 'RA-05', title: '고위험 승인', detail: '안전관리자 승인 필수' },
  { id: 'RA-06', title: 'RA 문서 자동 출력', detail: 'PDF 변환, 고객사 양식 대응' },
]

export const driRequirements: Requirement[] = [
  { id: 'DRI-01', title: '작업 전 점검', detail: '모바일 기반 위험예지 활동' },
  { id: 'DRI-02', title: '체크항목 자동 생성', detail: '공정+장비 기반 체크리스트 생성' },
  { id: 'DRI-03', title: '사진·서명', detail: '서명·사진 첨부' },
  { id: 'DRI-04', title: '보고서 자동 생성', detail: 'PDF 출력' },
]

export const checklistRequirements: Requirement[] = [
  { id: 'CL-01', title: '템플릿', detail: '작업유형별 템플릿 제공' },
  { id: 'CL-02', title: '모바일 체크', detail: '실시간 체크' },
  { id: 'CL-03', title: '필수 사진', detail: '필수사진 촬영 강제' },
  { id: 'CL-04', title: 'GPS 기록', detail: '점검 위치 자동 저장' },
  { id: 'CL-05', title: '부적합 처리', detail: '개선조치 생성' },
  { id: 'CL-06', title: '작업중지', detail: 'Stop Work 기능' },
]

export const patrolRequirements: Requirement[] = [
  { id: 'PT-01', title: '패트롤 루트', detail: '순찰 코스 등록' },
  { id: 'PT-02', title: '위험 발견', detail: '사진·텍스트 입력' },
  { id: 'PT-03', title: '즉시 조치', detail: '반장/PM 알림' },
  { id: 'PT-04', title: '통계 분석', detail: '패턴 분석' },
]

export const educationRequirements: Requirement[] = [
  { id: 'ED-01', title: '교육 이력', detail: '법정교육/특별교육 기록' },
  { id: 'ED-02', title: '자격증 관리', detail: '자격증·만료일 저장' },
  { id: 'ED-03', title: '만료알림', detail: '30/60/90일 알림' },
  { id: 'ED-04', title: '자료관리', detail: '영상·PDF 업로드' },
]

export const incidentRequirements: Requirement[] = [
  { id: 'AC-01', title: '사고 보고', detail: '사고 개요·원인 기록' },
  { id: 'AC-02', title: '아차사고', detail: '유형 분류 및 지도 표시' },
  { id: 'AC-03', title: '재발방지', detail: '개선조치 입력' },
  { id: 'AC-04', title: '통계', detail: '유형별 사고 분석' },
]

export const reportRequirements: Requirement[] = [
  { id: 'RP-01', title: '보고서 자동 생성', detail: '고객사 양식 자동출력' },
  { id: 'RP-02', title: '사진 자동배치', detail: '사진·캡션 자동 배치' },
  { id: 'RP-03', title: '일/주/월 보고', detail: 'PDF 출력' },
  { id: 'RP-04', title: '결재 프로세스', detail: '승인 워크플로우 제공' },
]

export const dataModel = [
  { name: '공정', fields: ['이름', '기간', '위험등급'] },
  { name: '위험요소', fields: ['코드', '설명', '빈도', '강도'] },
  { name: '점검', fields: ['점검자', '위치', '사진', '결과'] },
  { name: '사고', fields: ['유형', '위치', '원인', '조치'] },
  { name: '교육', fields: ['교육명', '이수일', '유효기간'] },
  { name: '자격증', fields: ['자격명', '유효기간'] },
]

export const aiRequirements: Requirement[] = [
  { id: 'AI-01', title: 'PPE 감지', detail: '헬멧/조끼 착용 여부 인식' },
  { id: 'AI-02', title: '위험동작 감지', detail: '협착·추락 위험 동작 인식' },
  { id: 'AI-03', title: '이상 패턴 분석', detail: '사고 증가 패턴 자동 감지' },
  { id: 'AI-04', title: 'RA 자동 생성', detail: '위험요소·조치 자동 추천' },
]

export const roles = [
  { name: '작업자', permissions: '체크리스트, 사진 업로드, 위험신고', level: '입력' },
  { name: '반장/현장책임자', permissions: '팀 구성, 점검 검토, 위험보고 승인', level: '중간 승인' },
  { name: '안전관리자', permissions: 'RA 승인, 패트롤, 교육·사고 관리', level: '전체 승인' },
  { name: '본사 안전팀', permissions: '분석·통계·보고서', level: '시스템 전체 관리' },
  { name: '고객사(옵션)', permissions: '보고서 열람', level: '읽기 전용' },
]
