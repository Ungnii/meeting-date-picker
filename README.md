# 모임날짜 잡기

Netlify(프론트엔드) + Render(백엔드) + Neon PostgreSQL(데이터베이스) 구성의 모임 일정 조율 웹앱입니다.

## 주요 기능
- 모임 생성 시 참여 링크와 별도 관리자 링크 발급
- 모임원 이름 + 개인 비밀번호로 가입/로그인
- 참석 불가능한 날짜 선택 및 수정
- 날짜별 불참자 확인, 응답 현황 및 최적 날짜 표시
- 관리자 화면에서 참여자 및 응답 현황 확인

## 1. 데이터베이스 준비
Neon에서 데이터베이스를 만든 뒤 SQL Editor에서 `server/schema.sql` 내용을 실행합니다.
Neon의 연결 문자열을 복사합니다. Render에서는 `DATABASE_URL` 환경 변수로 등록합니다.
연결 문자열에 `?sslmode=require`가 포함되어 있는지 확인하세요.

## 2. 백엔드(Render)
- 새 Web Service 생성 후 이 프로젝트의 `server` 폴더를 배포합니다.
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`
- 환경 변수:
  - `DATABASE_URL`: Neon 연결 문자열
  - `JWT_SECRET`: 충분히 길고 무작위인 비밀 문자열
  - `CLIENT_ORIGIN`: 배포한 Netlify 주소 (예: https://your-app.netlify.app)
  - `NODE_ENV`: `production`

배포 후 Render 주소를 확인합니다. 예: `https://your-api.onrender.com`

## 3. 프론트엔드(Netlify)
- Netlify에 GitHub 저장소를 연결합니다.
- Base directory: `client`
- Build command: `npm run build`
- Publish directory: `dist`
- 환경 변수 `VITE_API_URL`에 Render 주소를 입력합니다. 끝에 `/api`를 붙이지 않습니다.
  - 예: `https://your-api.onrender.com`

Netlify의 SPA 라우팅을 위해 `client/public/_redirects` 파일이 포함되어 있습니다.

## 4. 로컬 실행
터미널 두 개를 열어 실행합니다.

백엔드:
```bash
cd server
npm install
cp .env.example .env
# .env 파일의 DATABASE_URL, JWT_SECRET 등을 입력
npm start
```

프론트엔드:
```bash
cd client
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:4000
npm run dev
```

## 보안 및 운영 참고
- 참여자 비밀번호는 bcrypt 해시로 저장합니다.
- 관리자 링크에는 충분히 긴 무작위 토큰이 포함됩니다. 관리자 링크는 모임장만 보관하고 공개하지 마세요.
- 관리자 링크를 잃어버리면 현재 초기 버전에서는 복구 기능이 없습니다.
- 이름은 모임 안에서 중복 등록할 수 없습니다.
- 초기 버전은 이메일/휴대전화 본인 인증이 아닌 이름+비밀번호 방식입니다.
- 관리자 링크와 참여 링크는 HTTPS 환경에서 사용하세요.
