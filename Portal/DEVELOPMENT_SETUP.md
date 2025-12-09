# Portal 개발환경 세팅 완료

## 📋 프로젝트 개요

**Cross Manager Portal**은 통합 관리 시스템의 중앙 허브로, 다음 4개의 서브 시스템에 대한 접근을 제공합니다:

- **PMS** (Project Management System) - 프로젝트 관리시스템
- **EMS** (Equipment Management System) - 장비 관리시스템
- **SWMS** (Scrap & Waste Management System) - 스크랩·폐기물 관리시스템
- **SMS** (Safety Management System) - 안전 관리시스템

## ✅ 개발환경 세팅 상태

### 1. 패키지 설치 완료
- ✅ 총 264개 패키지 설치 완료
- ✅ 취약점 없음 (0 vulnerabilities)
- ✅ 설치 시간: 16초

### 2. 개발 서버 실행 중
- ✅ Vite 개발 서버 실행 중
- ✅ 포트: **5173**
- ✅ URL: http://localhost:5173/
- ✅ 시작 시간: 723ms

## 🛠 기술 스택

### Core
- **React** 19.2.0
- **TypeScript** 5.9.3
- **Vite** 7.2.4

### 라우팅 & 상태관리
- **React Router DOM** 7.10.1
- **React Context API** (AuthContext)

### UI & 애니메이션
- **Framer Motion** 12.23.25
- **Lucide React** 0.556.0 (아이콘)

### 백엔드 & 인증
- **Firebase** 12.6.0
  - Firebase Authentication
  - Cloud Firestore

### 개발 도구
- **ESLint** 9.39.1
- **TypeScript ESLint** 8.46.4

## 📁 프로젝트 구조

```
Portal/
├── public/
│   ├── create_ceo.html          # CEO 계정 생성 유틸리티
│   ├── images/                  # 이미지 리소스
│   └── vite.svg                 # Vite 로고
│
├── src/
│   ├── assets/                  # 정적 리소스
│   ├── context/
│   │   └── AuthContext.tsx      # 인증 컨텍스트
│   ├── lib/
│   │   └── firebase.ts          # Firebase 설정
│   ├── pages/
│   │   ├── Login.tsx            # 로그인 페이지
│   │   ├── Login.css            # 로그인 스타일
│   │   ├── Dashboard.tsx        # 대시보드 (메인)
│   │   └── Dashboard.css        # 대시보드 스타일
│   ├── App.tsx                  # 메인 앱 컴포넌트
│   ├── App.css                  # 앱 스타일
│   ├── ErrorBoundary.tsx        # 에러 경계
│   ├── index.css                # 글로벌 스타일
│   └── main.tsx                 # 진입점
│
├── .env                         # 환경 변수
├── .gitignore                   # Git 제외 파일
├── eslint.config.js             # ESLint 설정
├── index.html                   # HTML 템플릿
├── package.json                 # 패키지 설정
├── tsconfig.json                # TypeScript 설정 (루트)
├── tsconfig.app.json            # TypeScript 설정 (앱)
├── tsconfig.node.json           # TypeScript 설정 (Node)
└── vite.config.ts               # Vite 설정
```

## 🔐 Firebase 설정

### 환경 변수 (.env)
```env
VITE_FIREBASE_API_KEY=AIzaSyCz6gX_tWuIQDoLWaw3axANZ8o73rdbDCI
VITE_FIREBASE_AUTH_DOMAIN=crossmanager-1e21c.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=crossmanager-1e21c
VITE_FIREBASE_STORAGE_BUCKET=crossmanager-1e21c.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1062603580882
VITE_FIREBASE_APP_ID=1:1062603580882:web:2d8cb5e5778e95faf8940b

# 서브 시스템 URL (개발 환경)
VITE_APP_URL_SMS=http://localhost:5173
VITE_APP_URL_EMS=http://localhost:5174
VITE_APP_URL_SWMS=http://localhost:5175
VITE_APP_URL_PMS=http://localhost:5176
```

### Firebase 서비스
- ✅ Authentication (이메일/비밀번호)
- ✅ Cloud Firestore (사용자 데이터)

## 🎨 주요 기능

### 1. 인증 시스템
- **로그인**: 이메일/비밀번호 기반
- **세션 관리**: Firebase Auth + Context API
- **보호된 라우트**: ProtectedRoute 컴포넌트
- **자동 리다이렉트**: 로그인 상태에 따른 자동 이동

### 2. 대시보드
- **사용자 정보 표시**: 이름, 이메일, 역할
- **시스템 카드**: 4개 서브 시스템 접근
- **권한 기반 접근**: 역할/allowedSystems 기반
- **애니메이션**: Framer Motion을 활용한 부드러운 전환

### 3. 사용자 역할 시스템
```typescript
interface UserData {
    uid: string;
    email: string | null;
    role?: string;              // 'Manager', 'SystemAdmin' 등
    customId?: string;          // 사용자 고유 번호
    name?: string;              // 사용자 이름
    allowedSystems?: string[];  // 접근 가능한 시스템 목록
}
```

### 4. 시스템 접근 제어
- **Manager/SystemAdmin**: 모든 시스템 접근 가능
- **일반 사용자**: allowedSystems 배열에 따라 제한
- **현재 설정**: 테스트를 위해 모든 사용자에게 접근 허용 (임시)

## 🚀 개발 명령어

### 개발 서버 시작
```bash
cd c:\ProjectCode\Cross\Portal
npm run dev
```
- 포트: 5173
- Hot Module Replacement (HMR) 지원

### 빌드
```bash
npm run build
```
- TypeScript 컴파일 후 Vite 빌드
- 출력 디렉토리: `dist/`

### 린트
```bash
npm run lint
```

### 프리뷰 (빌드 결과 확인)
```bash
npm run preview
```

## 🌐 포트 할당

| 시스템 | 포트 | URL |
|--------|------|-----|
| **Portal** | 5173 | http://localhost:5173 |
| SMS | 5173 | http://localhost:5173 |
| EMS | 5174 | http://localhost:5174 |
| SWMS | 5175 | http://localhost:5175 |
| PMS | 5176 | http://localhost:5176 |

## 📝 다음 단계

### 1. 사용자 데이터 구조 확정
- Firestore `users` 컬렉션 스키마 정의
- 역할 및 권한 체계 구체화

### 2. 권한 관리 강화
- 현재 임시로 모든 접근 허용 중
- 실제 역할 기반 접근 제어 구현 필요

### 3. UI/UX 개선
- 로딩 상태 개선
- 에러 처리 강화
- 반응형 디자인 최적화

### 4. 통합 테스트
- 4개 서브 시스템과의 연동 테스트
- 로그인/로그아웃 플로우 검증
- 권한별 접근 테스트

### 5. 배포 준비
- 프로덕션 환경 변수 설정
- Firebase 호스팅 또는 다른 플랫폼 배포
- 빌드 최적화

## 🎯 현재 상태

✅ **개발환경 세팅 완료**
- 모든 패키지 설치 완료
- 개발 서버 정상 실행 중
- Firebase 연동 완료
- 기본 인증 시스템 구현 완료
- 대시보드 UI 구현 완료

## 📞 접속 방법

1. 브라우저에서 http://localhost:5173 접속
2. 로그인 페이지에서 Firebase 계정으로 로그인
3. 대시보드에서 원하는 시스템 선택

---

**작성일**: 2025-12-09  
**작성자**: Antigravity AI  
**프로젝트**: Cross Manager Portal  
**버전**: 0.0.0
