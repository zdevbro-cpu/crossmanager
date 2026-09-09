# Cross 통합관리시스템 — 진행 현황 및 다음 작업

작성일: 2026-09-08
근거 문서: `docs/크로스특수_통합관리시스템_설계개요서_v0.1`, `docs/크로스특수_통합관리시스템_상세설계서_v0.2`

---

## 1. 지금까지 한 것

### 1.1 DMS 저장소 전환 (Firebase Storage → Google Drive)

| 항목 | 상태 |
|---|---|
| 드라이브 연동 모듈 `Server/lib/drive.js` | 완료·검증 |
| 문서 업로드·버전·다운로드 드라이브 전환 | 완료·검증 |
| 기존 문서 558건 드라이브 이관 | 완료 (실패 1건 = 원본이 0바이트인 빈 파일) |
| Firebase 버킷 삭제 (637개 / 2.06GiB) | 완료. 삭제 목록은 `Server/firebase_bucket_deleted_20260908.txt` |
| base64 DB 저장 제거 | 완료 |
| 0바이트 업로드 버그 수정 | 완료 (busboy finish 가 디스크 쓰기보다 먼저 나던 문제) |

**드라이브 사용 시 지킨 제약 3가지**
1. 서비스 계정이 아닌 OAuth 리프레시 토큰 — 서비스 계정은 저장 용량이 없어 `storageQuotaExceeded`
2. 버전마다 새 파일 생성 — 드라이브 리비전은 `keepForever` 미지정 시 30일 후 자동 삭제, 지정해도 200개 상한
3. 드라이브 링크를 화면에 노출하지 않고 서버가 중계 — 링크를 주면 감사 로그가 빔 (설계서 9.4)

### 1.2 M0 — 기반 마스터

`code_group` `code` `client` `company` `site_company` `location` `location_client_code`
`user_account` `role` `user_role` `role_permission`

**위치 코드 방침 (확정)**
- 크로스특수 자체 코드가 정본: `OC8-1F-CR01` (동-층-구역, `full_code` 전방일치 인덱스)
- 발주처 표기는 `location_client_code` 에 별도 저장
  - LGES → "OC8동 1F 클린룸 및 반입구"
  - 코오롱 → "SR5"
- 서류 출력 시에만 발주처 표기로 변환

### 1.3 M1 — 근로자·만료 알림

`worker` `worker_qualification` `worker_health` `worker_site_assignment`
`equipment_document` `expiry_watch`

- 배치 `Server/scripts/expiry-scan.js` 가동
- 자격·건강검진 만료 → 현장 배정 `entry_status = BLOCKED` 자동 전환
- 갱신하면 `ALLOWED` 자동 복구 (검증 완료)

### 1.4 M2 — 문서 체계·제출 패키지

`doc_type`(29종) `retention_policy` `document_link`
`client_profile`(3) `client_required_doc`(24) `submission` `submission_item`
`template` `template_mapping`

- 기존 문서 559건 중 529건 문서유형 자동 매칭, 318건 보존연한 산정, 10건 개인정보 표시
- 제출 패키지 자동 전개 검증 — LGD 작업심의 10종 중 보유 문서 3건 자동 충족

### 1.5 M3 — RA 라이브러리

`work_type`(16) `hazard_item`(967) `tbm_hazard` `tbm_attendee`
`work_permit` `work_permit_approval` `work_permit_condition`
`sms_risk_assessments`/`sms_risk_items` 컬럼 확장

- RA 3단 상속(회사표준→현장→회차) 검증 완료. 수정분 `is_overridden`, 제외분 `REMOVED`
- 현장 RA 파일 101건 파싱 → 964건 적재 (`Server/scripts/parse-ra-files.js`)

### 1.6 API·화면

- `/api/master` 신설 — 코드·발주처·업체·위치·근로자·만료·공종·라이브러리·검수·제출
- SMS 화면 3개 추가
  - `/sms/expiry` 만료 알림
  - `/sms/hazard-library` 위험요인 라이브러리
  - `/sms/hazard-review` 위험요인 검수

---

## 2. 다음에 할 것

### 2.1 최우선 — 위험요인 라이브러리 검수

**961건이 검수 대기 중이고, 이게 풀려야 RA 자동화가 의미를 갖는다.**

```
통과 완료        6건
대기 · 등급 있음  65건   ← 바로 통과 가능
대기 · 등급 없음 896건   ← 빈도·강도 입력 필요
```

`/sms/hazard-review` 에서 처리한다. 등급 없는 항목은 통과되지 않도록 막아 두었다 —
등급 없는 위험요인은 평가서에 쓸 수 없기 때문이다.

- [ ] 등급 있는 65건 먼저 훑어 통과시키기
- [ ] 등급 없는 896건은 공종·위험분류·빈도·강도를 채우며 정리
- [ ] 안전관리팀 확인: 부록 A.4 등급 매트릭스(20~25=A / 15~16=B / 10~12=C / 1~9=D)
      → 코오롱 현장 파일 실측값과 일치함을 확인했으나 회사 공식 기준과 대조 필요

### 2.2 파서 개선

- [ ] 40개 파일이 표 인식 실패 — 양식이 크게 다르거나 이미지 기반
- [ ] `감소대책` 컬럼 매핑 실패 (등급 있는 항목에도 대책이 안 붙는 경우)
- [ ] 위험분류 미분류 897건 — 컬럼 위치가 파일마다 달라 매칭 실패

```bash
cd Server
node scripts/parse-ra-files.js --scan               # 대상 파일 확인
node scripts/parse-ra-files.js --inspect "<파일>"   # 표 구조 확인
node scripts/parse-ra-files.js --load               # 적재 (중복은 건너뜀)
```

### 2.3 마스터 데이터 입력

스키마만 있고 실데이터가 없다. 화면을 열어도 빈 목록이다.

- [ ] 협력업체 등록 (JINP, 진풍, 젠스엠, HLB일렉 등 — 개요서 8.1)
- [ ] 근로자·자격증 등록 → 만료 알림이 실제로 울리기 시작함
- [ ] 현장별 위치 코드 등록 + 발주처 표기 매핑
- [ ] 장비·검사증 등록

### 2.4 설계서 후속 단계

| 순위 | 항목 | 상태 |
|---|---|---|
| 1 | 마스터 + 만료 알림 (패턴 A) | 스키마·API·화면 완료. **데이터 입력 남음** |
| 2 | 게시물·출력물 생성기 (패턴 I) | 미착수. `template`/`template_mapping` 준비됨 |
| 3 | 사진·서명 + 모바일 유입 (패턴 D) | 미착수 |
| 4 | 제출 패키지 + 협력사 계정 (패턴 C) | 제출 완료. **협력사 계정 남음** |
| 5 | RA 라이브러리·캐리포워드 | 라이브러리 완료. **TBM 캐리포워드 배치 남음** |
| 6 | 정기 집계 (패턴 E) | 미착수 |

---

## 3. 알아둘 것

### 3.1 접속 정보

```
배포        https://crossmanagern.web.app
DB          34.64.243.133 / cross_manager / postgres
드라이브 폴더  CrossDMS_문서보관 (shinsh4600 계정)
```

`Server/env_customer.env` 가 `.env` 보다 우선 로드된다. 두 파일 모두 갱신해야 한다.

### 3.2 드라이브 OAuth

`crossmanager-482403` 프로젝트의 클라이언트는 **쓰지 않는다.**
`.../auth/drive` 가 제한된 범위라 구글 심사 없이는 앱 게시가 불가능하고,
게시 전에는 리프레시 토큰이 7일마다 만료된다.

→ 이미 프로덕션으로 게시된 클라이언트(프로젝트 `773827095855`, wbmanager 와 공유)를 쓴다.
   토큰 만료 없음.

토큰 재발급이 필요하면:
```bash
cd Server
node scripts/get-refresh-token.js
# 출력 URL → shinsh4600 로그인 → 토큰을 .env 와 env_customer.env 양쪽에 반영
```

### 3.3 점검 도구

```bash
cd Server
node scripts/verify-dms.js      # DB·드라이브 상태 한 번에 확인
node scripts/expiry-scan.js     # 만료 스캔 (--dry-run 지원)
```

### 3.4 배포

```bash
cd C:\ProjectCode\Cross
firebase deploy --only functions          # API
cd sms && npm run build && cd ..
cp -r sms/dist/* dist_all/sms/
firebase deploy --only hosting            # 화면
```

`Server/routes/*.js` 를 고치면 `functions/routes/*.js` 에도 복사해야 한다.
두 벌이 따로 관리되고 있고, `functions/routes/documents.js` 쪽이 상위 버전이다
(폴더 관리 API·서명 URL 다운로드 포함).

---

## 4. 설계서와 실제가 다른 점 (확인됨)

| 설계서 기재 | 실제 |
|---|---|
| 11.3절 현행 테이블 목록 (`init_db.sql` 기준) | 실제 Cloud SQL 과 다름. `personnel`·`safety_educations`·`equipments`·`document_approvals`·`document_shares` 없음 |
| 11.4.3 `riskTemplates.ts` "플레이스홀더 다수" | **1,634건 전부** 플레이스홀더. `risk_factor` 전부 "위험성", `measure` 전부 "내용 확인 필요". 씨앗으로 사용 불가 — 공종 분류만 살림 |
| 부록 A.4 등급 매트릭스 "역산값, 확인 필요" | 코오롱 현장 파일 실측값과 **일치 확인** (3×2=D, 5×2=C, 4×4=B, 4×5=A) |

---

## 5. 미해결

- [ ] 위험성 등급 매트릭스 회사 공식 기준 대조 (안전관리팀)
- [ ] `Server/uploads/` 임시파일 22개 — 이제 생성되지 않음. 정리 여부 판단 필요
- [ ] 기존 Firebase 문서 다운로드 폴백 — 코드에 남겨뒀으나 버킷을 비웠으므로 사실상 미사용
- [ ] `Server` 와 `functions` 의 라우터 이중 관리 구조 정리

---

# 2026-09-09 작업분 (커밋 47건 · 원격 푸시 완료)

## 오늘 한 것

### 화면 구조
- 4개 모듈(SMS·PMS·EMS·SWMS) 좌측 사이드바 전환, 메뉴는 하나도 빼지 않고 성격별로 묶음
- 본문 좌측정렬 + 폭 제한 제거. 제한이 `.content` → `.page` → 인라인 style 3겹에 걸려 있었다
- 모듈마다 달랐던 안쪽 여백을 `.content` 1.5rem 한 곳으로 통일, 스크롤바 어둡게
- 포털 카드 PMS·DMS·SMS·EMS 순 4열, 아이콘 색 구분

### 마스터·양식
- 공통코드 모듈 구분(`code_group.module`). 조회는 `해당 모듈 + COMMON`, COMMON 은 읽기 전용(서버에서도 막음)
- SMS 마스터 「기준정보」 신설 — 10개 탭, 공통코드만 편집
- RA 양식 등록·출력 + 등록 화면
- **TBM 양식 등록기** — 인식기(`lib/tbm-template.js`) + API + 화면 + 출력.
  RA 와 달리 '라벨 옆 칸 좌표'로 채운다. 드라이브 양식 6종으로 검증
- 프로젝트 문서 체크리스트(PMS) — 표준문서 대비 양식 등록 현황
- 발주처 마스터를 PMS 시스템관리로 이동, 프로젝트가 마스터를 참조하도록 전환

### PMS
- **프로젝트 저장 복구** — API 가 없는 컬럼 7개(`client`·`address`·`start_date`…)를 참조해 저장이 실패했다.
  컬럼 추가 + 발주처는 `client_id` 참조로 전환
- **일정(WBS) → 마일스톤 달력**. 간트는 삭제(`/schedule` 은 마일스톤으로 리다이렉트).
  같은 `tasks` 테이블을 쓰므로 데이터는 그대로
- 마일스톤에 TBM·교육·위험성평가·순찰·점검·만료 겹쳐 보기(`GET /api/calendar`)
- 전체 프로젝트 보기 + 현장 배지

### DMS
- **유실된 소스 복구** — 저장소에 없던 897행 대시보드·검색모달·API 훅을 이력에서 되살리고,
  한 번도 커밋된 적 없는 11개 파일은 PMS 에서 재구성
- **문서 바로보기 복구** — 원인 3중: 드라이브 분기 누락 + 배포본에 Word/Excel 라우트 부재 + 라우트 충돌
- 검색을 모달 → 화면 상시 필터(2줄 5열)로
- 문서 대분류 추가 기능, 목록 더블클릭으로 열기

### 데이터·인프라
- **`index.html` 캐시 무효화** — 배포해도 최대 1시간 동안 옛 화면이 뜨던 문제
- 프로젝트 상태 `ACTIVE` 통일(+CHECK 제약), 프로젝트 표기 `[코드] 명칭` 통일
- `tasks` 테이블 신설 — 없어서 보고서 생성과 일정 화면이 통째로 실패했다
- 순찰·점검에 실시일(`date`) 추가. `created_at`(입력 시각)과 다르다
- 체크리스트의 목업 프로젝트(`'p1'`) 제거 → 상단에서 고른 현장 사용
- 인코딩 깨진 문서 8건 논리 삭제(첨부 없는 빈 DRAFT, 복구 불가)
- SWMS 접근 제한(원방업무관리 결정 전까지). 해제는 스위치 2곳:
  `Portal/src/pages/Dashboard.tsx` 의 `RESTRICTED_SYSTEMS`, `swms/src/App.tsx` 의 `ACCESS_RESTRICTED`

## 오늘 추가된 마이그레이션 (전부 Cloud SQL 적용 완료)

```
20260909_code_module.sql              공통코드 모듈 구분
20260909_ra_template_registration.sql RA 양식 등록
20260909_doc_checklist.sql            문서 체크리스트 + 크로스 기본 프로파일
20260909_projects_columns.sql         프로젝트 컬럼 정리
20260909_project_status_active.sql    상태 ACTIVE 통일
20260909_tasks.sql                    일정 작업 테이블
20260909_tasks_fix.sql                predecessors text[] 정정
20260909_patrol_checklist_date.sql    순찰·점검 실시일
```

## 다음에 할 것

- [ ] 검수 대기 위험요인 897건 등급 부여
- [ ] 협력업체·인력·장비 마스터 입력 (현재 0건)
- [ ] 체크리스트 템플릿 0건 — 등록해야 점검 기능이 돈다
- [ ] 마스터 일괄 등록(엑셀 업로드) — 쓰기 API 없음
- [ ] `Server` 와 `functions` 라우터 이중 관리 정리

## 집에서 시작할 때

1. `git pull origin dms-drive-m0m3`
2. **환경설정 파일 12개는 깃에 없다.** 회사 PC 에서 따로 옮겨야 한다:
   ```
   Server/.env.local  Server/.env  Server/env_customer.env  Server/serviceAccountKey.json
   functions/.env
   sms/.env.local  pms/.env.local  dms/.env.local  swms/.env.local  Portal/.env.local
   ems/.env  ems/.env.local
   ```
   여기에 Cloud SQL 접속정보와 구글 드라이브 OAuth 리프레시 토큰이 들어 있다.
3. 각 폴더에서 `npm install` (`Server` `functions` `sms` `pms` `dms` `ems` `swms` `Portal`)
4. DB 는 Cloud SQL 공용이라 마이그레이션을 다시 적용할 필요 없다.
   집 IP 가 Cloud SQL 승인 네트워크에 없으면 접속이 막힌다 — 콘솔에서 추가해야 한다.

## 알아둘 것 (오늘 새로 확인)

- 배포는 `firebase deploy --only hosting,functions`. 화면은 각 모듈 `npm run build` 후
  `dist_all/<모듈>/` 로 복사해야 반영된다
- bash·curl 로 한글을 보내면 값이 깨져 저장된다. 검증은 Node 스크립트(UTF-8)로 할 것
- `Server/routes/*.js` 를 고치면 `functions/routes/*.js` 에도 복사해야 한다.
  `Server/index.js` 와 `functions/app.js` 도 마찬가지다
- 같은 경로의 라우트가 여러 번 등록된 곳이 있다. **먼저 등록된 것이 이긴다** —
  `/api/projects` 는 3개, `/api/docview` 는 하위 경로와 충돌했었다
