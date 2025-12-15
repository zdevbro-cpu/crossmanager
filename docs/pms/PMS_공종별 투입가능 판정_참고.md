아래는 \*\*"공종별 투입가능 판정(Eligibility)"\*\*을 시스템에서 돌릴 수 있도록, 공종(작업군)마다 \*\*필수 자격증(면허 포함)\*\*을 "기본안(템플릿)"으로 정의한 것입니다.  
※ 실제 **법정 필수**는 공사종류/발주처/현장규정에 따라 달라질 수 있어, 시스템에서는 "기본 템플릿 + 프로젝트별 오버라이드" 구조를 권장합니다.  
또한 자격증과 별개로, 현장에서는 **특별안전보건교육(비계/동바리/활선/밀폐 등)** 이 투입요건에 함께 들어가는 경우가 많아, 룰 엔진에서 "교육 요건"도 같이 관리하는 게 안전합니다. [법제처+1](https://law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=130833399&gubun=&utm_source=chatgpt.com)

**1) 시스템에서 쓰기 좋은 "요건" 표현 방식(추천)**

- 공종(작업군) = TRADE_CODE
- 요건 = **(A)필수 자격증(AND/OR)** + **(B)필수 교육** + **(C)문서 검증(verified)**

예시(개념):

- required_certs_all: 모두 갖춰야 하는 자격
- required_certs_any: 이 중 하나만 있으면 되는 자격(대체 가능)
- required_trainings: 교육 이수 요건(별도)

**2) 공종별 "필수 자격증" 기본 템플릿(현장투입/엔지니어링 중심)**

**A. 장비/운반(면허 성격이 강함)**

- **굴삭기/로더/불도저/천공기/타워크레인/이동식크레인 등 건설기계 조종**

- **필수(해당 기종 조종자)**: 건설기계조종사면허(해당 기종) [법제처](https://law.go.kr/LSW/flDownload.do?flNm=%5B%EB%B3%84%ED%91%9C+21%5D+%EA%B1%B4%EC%84%A4%EA%B8%B0%EA%B3%84%EC%A1%B0%EC%A2%85%EC%82%AC%EB%A9%B4%ED%97%88%EC%9D%98+%EC%A2%85%EB%A5%98%28%EC%A0%9C75%EC%A1%B0+%EA%B4%80%EB%A0%A8%29%0A&flSeq=41405081&utm_source=chatgpt.com)
- (참고) 일부 소형 장비는 예외 규정이 있어, 시스템에 "톤수/기종" 속성을 두고 룰로 분기하는 게 좋습니다. [법제처](https://law.go.kr/LSW/flDownload.do?flNm=%5B%EB%B3%84%ED%91%9C+21%5D+%EA%B1%B4%EC%84%A4%EA%B8%B0%EA%B3%84%EC%A1%B0%EC%A2%85%EC%82%AC%EB%A9%B4%ED%97%88%EC%9D%98+%EC%A2%85%EB%A5%98%28%EC%A0%9C75%EC%A1%B0+%EA%B4%80%EB%A0%A8%29%0A&flSeq=41405081&utm_source=chatgpt.com)

- **지게차 운전**

- **필수(지게차 운전 담당자)**: 지게차운전기능사(현장 표준으로 요구하는 경우가 많음) [Q-Net](https://www.q-net.or.kr/crf005.do?id=crf00505&jmCd=7875&utm_source=chatgpt.com)
- (법/면허 분기) 3톤 미만 지게차는 예외 규정이 존재하므로, 실제 운영규정에 맞춰 "운전면허로 대체 가능 여부"를 프로젝트 옵션으로 두는 방식이 안전합니다. [법제처](https://law.go.kr/LSW/flDownload.do?flNm=%5B%EB%B3%84%ED%91%9C+21%5D+%EA%B1%B4%EC%84%A4%EA%B8%B0%EA%B3%84%EC%A1%B0%EC%A2%85%EC%82%AC%EB%A9%B4%ED%97%88%EC%9D%98+%EC%A2%85%EB%A5%98%28%EC%A0%9C75%EC%A1%B0+%EA%B4%80%EB%A0%A8%29%0A&flSeq=41405081&utm_source=chatgpt.com)

**B. 전기/계장**

- **전기공사(저압/내선/배선/전기설비)**

- **필수(책임 기술자/반장급 최소 1명)**: 전기공사기사/전기공사산업기사 또는 전기관련 산업기사 이상 등 "전기공사기술자" 요건 충족자(공사업 등록기준에 근거한 실무 운용) [Q-Net](https://www.q-net.or.kr/crf005.do?gId=&gSite=Q&gbnn=gbnSubtab2&id=crf00501&jmCd=2150&jmNm=%EC%A0%84%EA%B8%B0%EA%B3%B5%EC%82%AC%EC%82%B0%EC%97%85%EA%B8%B0%EC%82%AC&jobSearch=N&utm_source=chatgpt.com)
- **권장(작업자)**: 전기기능사 등 현장 기준으로 추가 가능(회사 정책)

활선/정전 등 특정 작업은 "자격증"이 아니라 **특별안전보건교육 요건**을 같이 붙이는 게 일반적입니다. [법제처](https://law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=130833399&gubun=&utm_source=chatgpt.com)

**C. 철골/용접/배관(품질·안전 책임이 있어 "자격+교육"이 자주 붙음)**

- **용접(철골/배관 포함)**

- **필수(용접 수행자)**: 용접기능사 또는 해당 용접 종목(예: 피복아크용접기능사) [Q-Net+1](https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=E223&utm_source=chatgpt.com)
- **권장(품질 중요 현장)**: 발주처/품질기준에 따라 WPS/PQR, 용접사 자격(내부/발주처 기준) 항목을 "문서요건"으로 추가

- **배관/기계설비(엔지니어링 포함)**

- **필수(설계/감리·책임급으로 운용 시)**: 건축설비기사(또는 동급 설비 분야 자격) [Q-Net](https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=1632&utm_source=chatgpt.com)
- **권장(가스/압력계통 작업 포함 시)**: 가스기능사 등 가스 관련 자격을 "조건부"로 연결 [Q-Net](https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=6335&utm_source=chatgpt.com)

**D. 안전·특수 유해 작업(법정 기준이 명확한 편)**

- **석면 해체·제거(해당 작업이 있는 공사에 한함)**

- **필수(관리/전담 인력)**: 산업안전보건법 체계에서 정한 **석면해체·제거 관리자과정 교육 이수 + 자격요건 충족자**(예: 토목·건축 분야 기술자격 또는 산업안전/건설안전/환경(대기/폐기물) 계열 산업기사 이상 등) [법제처+1](https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=153273187&gubun=&utm_source=chatgpt.com)
- 이 공종은 개인 자격만이 아니라 "업(業) 등록/인력기준"이 따라붙는 경우가 많아, 프로젝트에 "석면 작업 여부" 플래그를 두고 강제 체크 권장. [법제처](https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=153273187&gubun=&utm_source=chatgpt.com)

- **위험물(유류/용제 등) 상시 취급/저장(현장 내 위험물 관리가 필요한 경우)**

- **필수(위험물 안전관리 담당자)**: 위험물기능사 이상 또는 가스기능사 이상 등 법령에 따른 자격 요건을 만족하는 안전관리자 [법제처+2Q-Net+2](https://law.go.kr/flDownload.do?flNm=%5B%EB%B3%84%ED%91%9C+3%5D+%EC%9C%84%ED%97%98%EB%AC%BC+%EC%95%88%EC%A0%84%EA%B4%80%EB%A6%AC%EC%9E%90%EC%9D%98+%EC%9E%90%EA%B2%A9+%EB%B0%8F+%EB%B3%B4%EC%9C%A0%EA%B8%B0%EC%A4%80%28%EC%A0%9C18%EC%A1%B0%EC%A0%9C1%ED%95%AD+%EA%B4%80%EB%A0%A8%29%0A&flSeq=30700428&utm_source=chatgpt.com)
- 작업자 전원 필수라기보다 "담당자 선임" 성격이 강하므로, 룰을 **ROLE=담당자**로 걸어두는 게 정확합니다.

**E. 현장 안전관리(관리자/감독자 성격)**

- **현장 안전관리(안전 담당/감독)**

- **권장(또는 발주/현장 규정에 따라 필수)**: 건설안전기사(또는 안전 관련 자격) [Q-Net](https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=1440&utm_source=chatgpt.com)
- 이 역시 "현장 필수 1명 이상" 같은 **ROLE 요건**으로 두는 편이 운영에 맞습니다.

**3) 운영 팁: "공종"을 더 잘게 쪼개야 정확해집니다**

공종을 크게 잡으면(예: "토목") 자격 판정이 애매해져요. 실무적으로는 아래처럼 **작업군(Work Type)** 단위로 쪼개는 걸 추천합니다.

- EQUIP_EXCAVATOR_OP (굴삭기 운전) → 건설기계조종사면허(굴삭기)
- LIFT_FORKLIFT_OP (지게차 운전) → 지게차운전기능사/예외룰
- ELEC_INSTALL (전기 설치) → 전기공사기술자(책임자 1명) + 작업자 정책
- WELD_ARC (피복아크 용접) → 피복아크용접기능사
- ASBESTOS_REMOVAL → 석면해체 관리자요건 + 교육
- HAZMAT_MANAGER → 위험물/가스 기능사 이상(담당자)

원하시면, Cross Specialness 쪽에서 실제 쓰실 공종 목록(예: 토공/철골/배관/전기/계장/인양/용접/해체/폐기물 등)을 기준으로 \*\*"공종 코드 체계 + required_certs_all/any 룰 JSON + 프로젝트별 오버라이드 방식"\*\*까지 딱 시스템에 넣을 수 있는 형태로 정리해드릴게요.

Cross Specialness 쪽에서 실제 쓰실 공종 목록(예: 토공/철골/배관/전기/계장/인양/용접/해체/폐기물 등)을 기준으로 \*\*"공종 코드 체계 + required_certs_all/any 룰 JSON + 프로젝트별 오버라이드 방식"\*\*까지 딱 시스템에 넣을 수 있는 형태로 정리해드릴게요. - 이 부분도 깔끔하게 정리해줘

12s 동안 생각함

아래는 Cross Specialness에서 실제 쓰기 좋은 형태로 **① 공종 코드 체계**, **② required_certs_all/any 기반 룰 JSON 스키마 + 예시**, **③ 프로젝트별 오버라이드(override) 방식**을 "바로 시스템에 넣을 수 있는 수준"으로 정리한 안입니다.

**1) 공종 코드 체계**

**1.1 계층 구조**

- **TRADE_GROUP(대공종)**: 큰 분류(토공/철골/전기 등)
- **WORK_TYPE(작업유형)**: 투입 가능 판정의 단위("굴삭기 운전", "저압 배선", "피복아크용접" 등)

판정(Eligibility)은 **반드시 WORK_TYPE 기준**으로 합니다. "토공" 같은 대공종은 너무 넓어서 자격 판정이 애매해집니다.

**1.2 네이밍 규칙**

- TG_\* : Trade Group 코드 (예: TG_EARTHWORK)
- WT_\* : Work Type 코드 (예: WT_EARTH_EXCAVATOR_OP)
- CERT_\*, TRN_\* : 자격/교육 템플릿 코드

**1.3 Cross Specialness 기본 공종/작업유형 예시(초안)**

**Trade Group**

- TG_EARTHWORK 토공
- TG_STEEL 철골
- TG_PIPING 배관/설비
- TG_ELECTRICAL 전기
- TG_INSTRUMENT 계장
- TG_LIFTING 인양/양중
- TG_WELDING 용접
- TG_DEMOLITION 해체
- TG_WASTE 폐기물/스크랩

**Work Type (예시)**

- 토공: WT_EARTH_EXCAVATOR_OP, WT_EARTH_LOADER_OP
- 철골: WT_STEEL_ERECTION, WT_STEEL_BOLT_TIGHTEN
- 배관: WT_PIPE_FAB, WT_PIPE_INSTALL, WT_PIPE_PRESSURE_TEST
- 전기: WT_ELEC_LOW_VOLT, WT_ELEC_PANEL, WT_ELEC_CABLE_TRAY
- 계장: WT_INST_LOOP_CHECK, WT_INST_CALIBRATION
- 인양: WT_LIFT_MOBILE_CRANE_OP, WT_LIFT_RIGGER, WT_LIFT_SIGNALMAN
- 용접: WT_WELD_SMAW, WT_WELD_GTAW
- 해체: WT_DEMO_GENERAL, WT_DEMO_ASBESTOS
- 폐기물/스크랩: WT_WASTE_SORTING, WT_WASTE_TRANSPORT, WT_SCRAP_GRADING

**2) 룰 JSON 스키마(시스템 저장용)**

**2.1 룰(Eligibility Rule) 기본 구조**

{

"rule_id": "UUID",

"version": 1,

"work_type_code": "WT_ELEC_LOW_VOLT",

"name": "저압 전기 설치 작업 투입 요건",

"effective": { "from": "2026-01-01", "to": null },

"required_certs_all": \["CERT_ELEC_WORKER_BASIC"\],

"required_certs_any": \["CERT_ELEC_ENGINEER_MANAGER", "CERT_ELEC_TECH_MANAGER"\],

"required_trainings_all": \["TRN_SAFETY_BASIC", "TRN_ELECTRICAL_SPECIAL"\],

"required_trainings_any": \[\],

"min_role_counts": \[

{ "role_tag": "RESPONSIBLE_MANAGER", "min": 1, "certs_any": \["CERT_ELEC_ENGINEER_MANAGER"\] }

\],

"conditions": {

"equipment": null,

"capacity_ton_min": null,

"site_flags_any": \[\]

},

"enforcement": {

"mode": "BLOCK",

"reason_code": "ELIGIBILITY_NOT_MET"

},

"notes": "프로젝트별 전기공사 책임자 1명 이상 배치 규칙 포함"

}

**2.2 필드 의미(핵심만)**

- required_certs_all: **모두 충족**해야 하는 자격
- required_certs_any: **하나 이상 충족**하면 되는 자격(대체 옵션)
- required_trainings_all/any: 교육 요건(자격과 동일 논리)
- min_role_counts: "작업팀 단위" 요건(예: 책임자 1명 필수)
- conditions: 장비/톤수/현장 플래그 등 조건부 룰 분기
- enforcement.mode
  - BLOCK: 미충족 시 배정/투입 **차단**
  - WARN: 경고만 띄우고 예외 승인 가능

**3) 자격/교육 템플릿 코드(카탈로그) 구조**

**3.1 자격(CERT) 템플릿 예시**

{

"cert_code": "CERT_LIFT_CRANE_MOBILE",

"name": "건설기계조종사면허(이동식크레인)",

"validity": { "type": "EXPIRES", "default_months": 60 },

"needs_verification": true,

"alert_days": \[90, 60, 30\]

}

**3.2 교육(TRN) 템플릿 예시**

{

"training_code": "TRN_SAFETY_BASIC",

"name": "기본 안전교육",

"validity": { "type": "EXPIRES", "default_months": 12 },

"alert_days": \[30, 14, 7\]

}

**4) Work Type별 룰 JSON 예시(바로 적용 가능한 샘플)**

**4.1 인양: 이동식 크레인 운전**

{

"work_type_code": "WT_LIFT_MOBILE_CRANE_OP",

"name": "이동식 크레인 운전",

"required_certs_all": \["CERT_LIFT_CRANE_MOBILE"\],

"required_certs_any": \[\],

"required_trainings_all": \["TRN_SAFETY_BASIC", "TRN_LIFTING_SPECIAL"\],

"required_trainings_any": \[\],

"min_role_counts": \[\],

"conditions": { "capacity_ton_min": null },

"enforcement": { "mode": "BLOCK", "reason_code": "CRANE_LICENSE_REQUIRED" }

}

**4.2 인양: 신호수(팀 내 최소 1명)**

{

"work_type_code": "WT_LIFT_SIGNALMAN",

"name": "양중 신호수",

"required_certs_all": \[\],

"required_certs_any": \["CERT_LIFT_SIGNALMAN"\],

"required_trainings_all": \["TRN_SAFETY_BASIC", "TRN_LIFTING_SPECIAL"\],

"required_trainings_any": \[\],

"min_role_counts": \[\],

"enforcement": { "mode": "BLOCK", "reason_code": "SIGNALMAN_REQUIRED" }

}

**4.3 용접: 피복아크(SMAW)**

{

"work_type_code": "WT_WELD_SMAW",

"name": "피복아크 용접(SMAW)",

"required_certs_all": \["CERT_WELD_SMAW"\],

"required_certs_any": \[\],

"required_trainings_all": \["TRN_SAFETY_BASIC", "TRN_HOT_WORK_SPECIAL"\],

"required_trainings_any": \[\],

"min_role_counts": \[\],

"enforcement": { "mode": "BLOCK", "reason_code": "WELD_CERT_REQUIRED" }

}

**4.4 전기: 저압 설치(팀에 책임자 1명)**

{

"work_type_code": "WT_ELEC_LOW_VOLT",

"name": "저압 전기 설치",

"required_certs_all": \["CERT_ELEC_WORKER_BASIC"\],

"required_certs_any": \[\],

"required_trainings_all": \["TRN_SAFETY_BASIC", "TRN_ELECTRICAL_SPECIAL"\],

"required_trainings_any": \[\],

"min_role_counts": \[

{ "role_tag": "RESPONSIBLE_MANAGER", "min": 1, "certs_any": \["CERT_ELEC_ENGINEER_MANAGER"\] }

\],

"enforcement": { "mode": "BLOCK", "reason_code": "ELECTRICAL_MANAGER_REQUIRED" }

}

**4.5 해체: 일반 해체(조건부로 석면 플래그가 켜지면 별도 Work Type 사용)**

{

"work_type_code": "WT_DEMO_GENERAL",

"name": "일반 해체",

"required_certs_all": \[\],

"required_certs_any": \[\],

"required_trainings_all": \["TRN_SAFETY_BASIC", "TRN_DEMOLITION_SPECIAL"\],

"required_trainings_any": \[\],

"min_role_counts": \[\],

"enforcement": { "mode": "WARN", "reason_code": "DEMO_SPECIAL_TRAINING_RECOMMENDED" }

}

**5) 프로젝트별 오버라이드(Override) 방식**

**5.1 "레이어" 우선순위(권장)**

- **Global Default 룰(회사 기본)**
- **Project Override(프로젝트별 강화/완화)**
- **Site Override(현장/구역별 추가 조건)**
- **Work Permit Override(작업허가서 기반 당일 특별조건)** _(선택)_

원칙적으로는 \*\*강화(더 엄격)\*\*만 허용하는 게 운영상 안전합니다. 완화는 관리자 승인+사유+기간 제한을 걸어두세요.

**5.2 Override 저장 모델(추천: Patch 기반)**

- 기본 룰은 그대로 두고,
- 프로젝트는 "차이점만" JSON Patch/merge 형태로 저장합니다.

**예: 프로젝트 A에서 저압 전기 작업에 "추가 자격(OR)"을 허용**

{

"project_id": "PJT_A",

"work_type_code": "WT_ELEC_LOW_VOLT",

"override_mode": "MERGE",

"patch": {

"required_certs_any_add": \["CERT_ELEC_ALT_OPTION"\],

"required_trainings_all_add": \["TRN_PROJECT_RULES_A"\]

},

"approved_by": "USER_123",

"approved_at": "2026-02-01T10:00:00+09:00",

"reason": "발주처 요구 추가교육 반영"

}

**5.3 Merge 규칙(정해두면 구현이 깔끔해짐)**

- \*\_add: 기존 배열에 **추가**
- \*\_remove: 기존 배열에서 **제거**
- \*\_replace: 해당 배열을 **완전 교체**
- enforcement.mode: 기본이 WARN이면 프로젝트에서 BLOCK으로 **상향 가능**
- 하향(BLOCK → WARN)은 **특별 권한 + 만료일** 필수

**6) PMS에서 "딱 쓰기 좋은" 검증 API 형태(권장)**

배정 화면에서 호출:

**요청**

{

"project_id": "PJT_001",

"date": "2026-03-10",

"work_type_code": "WT_WELD_SMAW",

"assignees": \["U1", "U2", "U3"\]

}

**응답(인력별 판정 + 팀 요건)**

{

"work_type_code": "WT_WELD_SMAW",

"eligible": false,

"team_issues": \[\],

"assignee_results": \[

{

"user_id": "U1",

"eligible": true,

"missing_certs": \[\],

"missing_trainings": \[\],

"expiring_soon": \["CERT_WELD_SMAW:D-14"\]

},

{

"user_id": "U2",

"eligible": false,

"missing_certs": \["CERT_WELD_SMAW"\],

"missing_trainings": \["TRN_HOT_WORK_SPECIAL"\],

"expiring_soon": \[\]

}

\],

"rule_trace": {

"base_rule_version": 1,

"overrides_applied": \["PROJECT:PJT_001"\]

}

}