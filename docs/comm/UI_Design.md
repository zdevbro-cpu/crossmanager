# UI Design Guide - Cross Specialness Inc.

## 1) 디자인 방향
- Modern Dark + Glass: 메인 배경 `#0b1324`, 카드/모달은 `rgba(255,255,255,0.03)` + blur(8~12px).
- Soft & Rounded: 카드/패널 14px, 입력/버튼 10px, 아이콘 버튼 8px 일관.
- 정보 우선: 표/리스트 가독성 우선, 색상은 의미(상태/경고/강조) 위주.

## 2) 토큰
- Color: Background `#0b1324`, Surface `rgba(255,255,255,0.03)`, Text `#e8ecf7` / Muted `#9fb2cc`, Accent `#8bd3ff`, Success `#16c482`, Warning `#f2c94c`, Danger `#ff6b6b`, Info `#4ea1ff`.
- Typography: Heading 600~700, 1.5rem/2.25rem 계단; Body 1rem, Muted 0.92rem; Font `'Pretendard','Noto Sans KR','Inter',system-ui`.
- Spacing: Page 24px, Card 16px, gap 8px/16px.

## 3) 레이아웃
- 상단 섹션 헤더(eyebrow/h2/subtext) + 카드/테이블 스택.
- 카드: 14px 라운드, 분리선 `1px rgba(255,255,255,0.08)`.
- 그리드: 2~4열, 모바일 단일 컬럼(좌우 여백 16px 확보).

## 4) 컴포넌트
- Button: Primary `#4ea1ff`(hover `#3b8ae0`), Outline 투명+`1px rgba(255,255,255,0.18)`, Danger `#ff6b6b`, Icon 32~40px/라운드 8px.
- Input/Select: 높이 38~40px, 라운드 10px, 배경 `rgba(255,255,255,0.04)`, 보더 `1px rgba(255,255,255,0.12)`, Focus `outline 2px rgba(139,211,255,0.8)`.
- Table: 헤더 배경 `rgba(255,255,255,0.03)`, 행 hover `rgba(255,255,255,0.04)`, 숫자/날짜 정렬 명시. 뱃지(`badge-live`/`badge-neutral`/`badge-warning`)로 상태 표시.
- Badges: 기본 `rgba(255,255,255,0.08)`, 라운드 999px, 0.85rem. 색상형 Success/Danger/Neutral 제공.
- Modal/Drawer: 오버레이 `rgba(0,0,0,0.55)`, 라운드 14px, max-width 720px, 액션 영역에 분리선.

## 5) 상태 & 피드백
- Validation: 필수값 누락 → 경고 토스트(노랑), 성공/실패 → 초록/빨강 토스트.
- Loading: 버튼 로더 또는 스켈레톤 2~3줄.
- Empty: 아이콘 + 짧은 안내 텍스트.

## 6) 아이콘
- 라이브러리 `lucide-react`, 18~24px.
- 버튼 내 아이콘과 텍스트 간격 6~8px, 색상은 상태 색상에 맞춤.

## 7) 모션
- 기본 트랜지션 150~220ms ease-out.
- 모달/토스트: 페이드+슬라이드 200~240ms, 과도한 바운스 금지.

## 8) 접근성/반응형
- 대비: 텍스트 WCAG AA(4.5:1) 이상, 배지/버튼 3:1 이상.
- 터치 타겟: 최소 40px, 모바일 테이블 좌우 스크롤 허용.
- 키보드: 포커스 링 항상 표시, tabindex 순서 논리적 유지.



## 9) 추가 정보
- 
# Cross Specialness Inc. - PMS Design System Guide

## 1. Design Principles (디자인 원칙)
* **Theme:** 다크 모드 (Dark Mode) 전용. 눈의 피로를 줄이고 데이터 가독성을 높이는 Deep Navy 계열의 배경 사용.
* **Layout:** 상단 GNB(Global Navigation Bar) + 중앙 콘텐츠 영역의 구조.
* **Hierarchy:** 정보의 중요도에 따라 색상의 명도와 폰트 크기를 조절하여 위계를 명확히 함.
* **Consistency:** 모든 입력 폼, 버튼, 테이블, 모달은 동일한 Radius(곡률)와 Padding(여백)을 가짐.

---

## 2. Color Palette (색상 시스템)

전반적으로 차분한 다크 블루/슬레이트 계열을 베이스로 하며, 상태 표시에 명확한 시그널 컬러를 사용합니다.

### 2.1 Backgrounds (배경)
* **Main Background:** `#0F172A` (Slate 900) - 전체 페이지 배경
* **Surface / Card:** `#1E293B` (Slate 800) - 컨텐츠 컨테이너, 카드, 모달 배경
* **Input / Dropdown:** `#0F172A` 혹은 `#334155` (Slate 700~900) - 입력 필드 배경

### 2.2 Text Colors (텍스트)
* **Primary Text:** `#F8FAFC` (Slate 50) - 제목, 주요 데이터
* **Secondary Text:** `#94A3B8` (Slate 400) - 레이블, 부가 설명, 비활성 텍스트
* **Placeholder:** `#475569` (Slate 600) - 입력 필드 플레이스홀더

### 2.3 Status & Accents (상태 및 강조)
* **Primary Brand:** `#38BDF8` (Sky 400) ~ `#2DD4BF` (Teal 400) - 주요 버튼, 활성 탭
* **Danger / Critical:** `#EF4444` (Red 500) - 위험, 삭제, 긴급 이슈
* **Warning / Delay:** `#EAB308` (Yellow 500) - 지연, 경고
* **Success / Safe:** `#22C55E` (Green 500) - 정상, 완료
* **Info / Cost:** `#A855F7` (Purple 500) - 비용, 일반 정보

---

## 3. Typography (타이포그래피)

가독성이 높은 산세리프 폰트(Pretendard, Noto Sans KR, Inter 등)를 사용합니다.

* **Page Title:** `text-2xl` (24px) / `font-bold` / Primary Text
    * *Ex: "임원용 통합 대시보드", "종합 계약/견적 관리"*
* **Section Header:** `text-lg` (18px) / `font-semibold` / Primary Text
    * *Ex: "Project Health Top Alerts", "계약 목록"*
* **Body Text:** `text-sm` (14px) / `font-normal` / Secondary Text
* **Label / Table Header:** `text-xs` ~ `text-sm` / `font-medium` / Secondary Text

---

## 4. UI Components (컴포넌트 가이드)

### 4.1 Navigation (GNB)
* **Height:** 약 64px
* **Style:** 투명 혹은 반투명 배경, 하단에 얇은 Border 없음(혹은 아주 옅게).
* **Items:** 텍스트 기반 탭.
    * *Inactive:* Text Slate-400
    * *Active:* Text White + 배경색이 있는 Pill 형태 혹은 텍스트 강조. (스크린샷상으로는 탭 배경이 짙은 회색으로 활성화됨)

### 4.2 Containers & Cards (컨테이너)
* **Appearance:** 배경 Slate 800, 테두리 Slate 700 (1px, 아주 옅게), 그림자 `shadow-lg`.
* **Border Radius:** `rounded-lg` (약 8px ~ 12px).
* **Header:** 카드 내부에 제목 영역과 콘텐츠 영역을 구분하는 얇은 Divider(`border-slate-700`)가 있는 경우가 많음.

### 4.3 Buttons (버튼)
* **Primary Action:** 채도가 있는 배경(Teal/Green) + 흰색 텍스트. `rounded-md`.
    * *Ex: "새 계약 작성", "보고서 작성", "배정 추가"*
* **Secondary / Icon:** 투명 배경 + 옅은 테두리 혹은 아이콘만 있는 형태.
    * *Ex: "항목 추가", "XML 가져오기"*
* **Negative:** 붉은색 텍스트 혹은 아이콘 (휴지통).

### 4.4 Inputs & Forms (입력 폼)
* **Style:** 배경 Slate 900/800, 테두리 Slate 600.
* **Focus:** Focus 시 Primary Color의 Border 색상 변경 (`ring-2 ring-primary`).
* **Layout:** Label은 Input 상단에 위치 (`flex-col`).
* **Select Box:** 기본 Input과 동일한 스타일. 화살표 아이콘 포함.

### 4.5 Tables (테이블)
* **Header:** 배경색이 Row보다 약간 짙거나 투명. 폰트는 `font-bold` 혹은 `font-medium`.
* **Rows:**
    * 배경: Slate 800 (기본).
    * Border: 하단에 `border-b border-slate-700`.
    * Hover: 마우스 오버 시 `bg-slate-700/50` 등으로 강조.
* **Status Badge:** 텍스트 + 둥근 배경(Pill shape)의 조합.
    * *진행:* Green Text + Green Background(Opacity 10-20%)
    * *준비:* Grey Text + Grey Background

---

## 5. Layout Patterns (레이아웃 패턴)

### 5.1 Dashboard (대시보드)
* **Top:** 핵심 지표(KPI) 카드 4~5개 배치 (위험, 지연, 손실 등).
* **Middle:** 좌측에 리스트/차트(Alerts), 우측에 Actionable Item(결재, 승인) 배치.
* **Bottom:** 차트 영역 (안전 리스크, 원가 현황).

### 5.2 List Page (목록 페이지 - 프로젝트, 계약 등)
* **Filter Area:** 상단에 드롭다운, 검색창, 날짜 선택기가 포함된 필터 바 배치.
* **Action Area:** 필터 바 우측 끝에 "생성/등록" 버튼 배치.
* **Data Area:** 하단에 테이블(Grid) 배치. 데이터가 없을 경우 "로딩 중" 또는 "데이터 없음" 문구 중앙 정렬.

### 5.3 Input/Detail Page (입력/상세 페이지)
* **Sectioning:** 관련된 정보끼리 그룹화(Box)하여 배치.
    * *Ex: 기본 정보, 금액 산출, 공사 범위 내역 등.*
* **Dynamic List:** 항목을 추가할 수 있는 리스트(Scope of Work 등)는 우측 상단에 `+ 항목 추가` 버튼을 배치하고, 각 행 우측에 `x` 삭제 버튼 배치.

---

## 6. Iconography (아이콘)
* **Style:** Line (Stroke) 스타일의 깔끔한 아이콘 사용 (Heroicons, Lucide React 등 추천).
* **Size:** 버튼 내 `w-5 h-5`, 메뉴 내 `w-6 h-6`.