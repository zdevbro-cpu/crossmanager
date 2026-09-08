# Cross 포털 통합 이슈 해결 보고서

## 작업 일시
2025-12-09

## 발견된 문제 및 해결 내역

### 1. ✅ 로고 깨짐 문제 (해결 완료)

**문제점:**
- PMS와 EMS: `public/Images` (대문자 I)
- SWMS와 SMS: `public/images` (소문자 i)
- Windows에서는 대소문자 구분이 없지만, Linux 배포 환경(Firebase Hosting)에서는 대소문자를 구분하여 로고가 깨짐

**해결 방법:**
```powershell
# PMS와 EMS의 Images 폴더를 images로 변경
Rename-Item -Path 'pms\public\Images' -NewName 'images'
Rename-Item -Path 'ems\public\Images' -NewName 'images'
```

**영향받는 파일:**
- `pms/public/images/cross-logo.png`
- `ems/public/images/cross-logo.png`
- `swms/public/images/cross-logo.png`
- `sms/public/images/cross-logo.png`

---

### 2. ✅ 로그아웃 시 포털 사인인 화면 미표시 문제 (해결 완료)

**문제점:**
- 각 서브모듈(PMS, EMS, SWMS, SMS)에서 로그아웃 시 Firebase 로그아웃만 수행
- 포털 로그인 페이지로 리다이렉트하지 않아 서브모듈의 로그인 화면이 표시됨

**해결 방법:**
각 모듈의 `useAuth.tsx`에서 `signOut` 함수 수정:

```typescript
const signOut = async () => {
  if (auth) {
    await firebaseSignOut(auth)
  }
  localStorage.removeItem(STORAGE_KEY) // SWMS, SMS만 해당
  setUser(null)
  // 포털 로그인 페이지로 리다이렉트
  window.location.href = '/'
}
```

**수정된 파일:**
- ✅ `pms/src/hooks/useAuth.tsx`
- ✅ `ems/src/hooks/useAuth.tsx`
- ✅ `swms/src/hooks/useAuth.tsx`
- ✅ `sms/src/hooks/useAuth.tsx`

---

### 3. ⚠️ 사인인 화면 두 번 나오는 문제 (추가 검토 필요)

**문제점:**
- Portal의 AuthContext와 각 서브모듈의 useAuth가 독립적으로 작동
- 포털에서 로그인 후 서브모듈 접근 시 서브모듈의 인증 체크가 다시 발생할 수 있음

**현재 구조:**
```
Portal (AuthContext)
  ├─ PMS (useAuth)
  ├─ EMS (useAuth)
  ├─ SWMS (useAuth)
  └─ SMS (useAuth)
```

**권장 해결 방안:**
1. **옵션 A: 포털 중심 인증** (권장)
   - 포털의 AuthContext를 모든 서브모듈에서 공유
   - 서브모듈의 독립적인 useAuth 제거
   - 장점: 단일 인증 흐름, 중복 로그인 방지
   - 단점: 서브모듈의 독립성 감소

2. **옵션 B: SSO 토큰 방식**
   - 포털에서 로그인 후 토큰 발급
   - 서브모듈은 토큰 검증만 수행
   - 장점: 서브모듈 독립성 유지
   - 단점: 구현 복잡도 증가

**현재 상태:**
- 각 모듈이 Firebase Auth 상태를 독립적으로 관리
- `onAuthStateChanged`로 자동 로그인 상태 동기화
- 실제로 "두 번 로그인"이 필요한지 재확인 필요

---

## 다음 단계

### 즉시 테스트 필요
1. 빌드 및 배포
   ```bash
   cd c:\ProjectCode\Cross
   build_all.bat
   firebase deploy
   ```

2. 테스트 시나리오
   - [ ] 각 모듈에서 로고가 정상적으로 표시되는지 확인
   - [ ] PMS에서 로그아웃 → 포털 로그인 페이지로 이동하는지 확인
   - [ ] EMS에서 로그아웃 → 포털 로그인 페이지로 이동하는지 확인
   - [ ] SWMS에서 로그아웃 → 포털 로그인 페이지로 이동하는지 확인
   - [ ] SMS에서 로그아웃 → 포털 로그인 페이지로 이동하는지 확인
   - [ ] 포털에서 로그인 → 서브모듈 접근 시 추가 로그인 요구 여부 확인

### 추가 검토 사항
1. **사인인 화면 두 번 나오는 문제**
   - 실제 발생하는지 확인
   - 발생 시 옵션 A 또는 B 중 선택하여 구현

2. **보안 검토**
   - 각 모듈의 인증 흐름 검토
   - 토큰 만료 처리 확인
   - CORS 설정 확인

---

## 참고사항

### 폴더 구조
```
Cross/
├── Portal/          # 포털 (루트)
│   └── public/images/cross-logo.png
├── pms/             # 프로젝트 관리
│   └── public/images/cross-logo.png  ✅ 수정됨
├── ems/             # 장비 관리
│   └── public/images/cross-logo.png  ✅ 수정됨
├── swms/            # 스크랩/폐기물 관리
│   └── public/images/cross-logo.png
├── sms/             # 안전 관리
│   └── public/images/cross-logo.png
└── Public/          # 공유 리소스
    └── images/cross-logo.png
```

### Firebase 배포 구조
```
dist_all/
├── index.html       # Portal
├── pms/             # PMS 서브모듈
├── ems/             # EMS 서브모듈
├── swms/            # SWMS 서브모듈
├── sms/             # SMS 서브모듈
└── images/          # 공유 이미지
```
