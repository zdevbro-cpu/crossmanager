# PMS UI Design System & Tone and Manner

본 문서는 프로젝트 신규 페이지 작성 시 **일관된 디자인(Tone & Manner)**을 유지하기 위한 상세 가이드라인입니다.
모든 UI 요소는 아래 정의된 **Radius(라운드), Color, Size** 규격을 준수해야 합니다.

## 1. 디자인 철학 (Core Philosophy)
- **Modern Dark Theme**: 딥 블루/네이비(` #0b1324`) 배경 + 글래스모피즘(Glassmorphism).
- **Soft & Round**: 딱딱한 직각 대신 **부드러운 라운드(10px~14px)**를 사용하여 현대적인 느낌 강조.
- **Micro-Interactions**: 호버 시 미세한 색상 변화 및 보더 글로우 효과 적용.

## 2. 컴포넌트 상세 규격 (Component Specs)

### 2.1 스크롤바 (Scrollbars)
시스템 기본 스크롤바를 숨기고, 다크 테마에 맞는 얇은 커스텀 스크롤바를 사용합니다.
- **Width**: `8px` (Thin)
- **Track (배경)**: `rgba(255, 255, 255, 0.02)` (투명에 가까운 명도)
- **Thumb (손잡이)**: `rgba(255, 255, 255, 0.08)` (라운드 `4px`)
- **Hover**: 호버 시 명도 증가 (`rgba(255, 255, 255, 0.12)`)

### 2.2 입력 필드 (Inputs) - Text / Dropdown
모든 입력 필드는 일관된 높이와 라운드 값을 가집니다.
- **Border Radius**: `10px` (필수)
- **Height (Padding)**: `0.55rem 0.7rem` (약 38~40px 높이)
- **Background**: `rgba(255, 255, 255, 0.04)` (반투명)
- **Border**: `1px solid rgba(255, 255, 255, 0.12)`
- **Focus State**: `outline: 2px solid rgba(139, 211, 255, 0.8)` (밝은 블루 글로우)
- **Dropdown Option Bg**: `#0d1428` (다크 네이비, 시스템 배경과 동일)

### 2.3 버튼 (Buttons)

#### (1) "+" 생성 버튼 (Create/Add Button)
주요 데이터 생성 액션(문서 생성, 추가 등)에 사용합니다.
- **Style**: 아이콘 단독 또는 텍스트 병기.
- **Class**: `.icon-button` 또는 헤더의 `.pill`
- **Icon**: `lucide-react`의 `<Plus size={18} />`
- **Icon Button Radius**: `8px` (정사각형에 가까운 형태)
- **Border**: `1px solid rgba(255, 255, 255, 0.12)`

#### (2) 일반 버튼 (Primary/Secondary)
- **Pill Shape**: `.pill` 클래스 사용 시 **Radius `999px`** (완전한 타원형).
- **Standard Shape**: `.btn-primary` 사용 시 **Radius `10px`**.

### 2.4 컨테이너 라운드 (Border Radius System)
요소의 크기에 따라 라운드 값을 차등 적용하여 시각적 안정감을 줍니다.
- **Page Container / Hero**: `16px`
- **Card / Panel / Modal**: `14px`
- **Input / Button**: `10px`
- **Icon Button / Badge**: `8px`

## 3. 컬러 팔레트 (Color Palette)

### Backgrounds
- **Main Background**: `#0b1324` (Deep Navy)
- **Card/Panel**: `rgba(255, 255, 255, 0.03)` + `backdrop-filter: blur(10px)`

### Text Colors
- **Primary**: `#e8ecf7` (화이트 블루)
- **Muted**: `#9fb2cc` (그레이 블루)
- **Accent**: `#8bd3ff` (스카이 블루)

## 4. CSS 및 코드 적용 예시

```css
/* Input 스타일 예시 */
.input-standard {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f2f6ff;
}

/* Scrollbar 예시 */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
```

## 5. 아이콘 표준 (Icon Standards)
- **Library**: `lucide-react`
- **Size**: 기본 `18px` ~ `24px`
- **Colors**:
  - **White (`#ffffff`)**: 어두운 배경 위 아이콘 (예: 업로드 버튼, 헤더 아이콘)
  - **Sky Blue (`#8bd3ff`)**: 강조, 링크, 파일명 등
  - **Muted Blue (`#9fb2cc`)**: 보조 텍스트, 비활성화 아이콘

### 주요 아이콘 매핑
- **파일**: `<FileText />` (문서 표현)
- **닫기/취소**: `<X />`
- **추가/선택**: `<Plus />`
- **업로드/저장**: `<Upload />`

## 6. 개발 원칙 (Development Rules)
1. **모든 모서리는 둥글게**: 직각(0px) 사용을 엄격히 금지합니다. 최소 6px 이상의 라운드를 적용하십시오.
2. **반투명 활용**: 완전한 검정/회색 배경보다는 `rgba`를 활용하여 배경 그라디언트가 은은하게 비치도록 하십시오.
3. **일관된 간격**: `gap: 0.5rem (8px)` 또는 `gap: 1rem (16px)` 단위로 컴포넌트를 배치하십시오.

## 7. 데이터 표시 원칙 (Data Display Policy)
*   **내부 ID 노출 금지**: 사용자에게 내부 관리용 ID(UUID, DB PK, 시스템 코드 등)를 노출하지 않는다.
*   **주요 식별자**: 문서는 항상 '파일명(File Name)' 또는 '사용자 지정 제목'을 주요 식별자로 사용하여 표시한다.
