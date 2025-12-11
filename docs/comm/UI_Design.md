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
