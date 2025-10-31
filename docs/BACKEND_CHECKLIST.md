# 백엔드 API 설정 체크리스트 (Railway 배포용)

이 체크리스트는 Railway에 배포할 백엔드 API를 개발하기 위한 주요 작업들을 정리합니다.

## 1. 기본 설정

- [x] **프로그래밍 언어 및 프레임워크 결정:**
  - [ ] Node.js (Express, NestJS 등)
  - [x] Python (FastAPI, Django, Flask 등) - **Django 사용**
  - [ ] 기타 (Go, Java Spring 등)
- [x] **프로젝트 초기화:** 선택한 언어/프레임워크에 맞는 프로젝트 구조 생성
- [x] **의존성 관리:** `package.json`, `requirements.txt` 등 설정
  - `backend/requirements.txt`에 `dj-database-url`, `whitenoise`, `gunicorn` 추가 완료.

## 2. API 엔드포인트 정의 및 구현

- [x] **주요 서비스 영역별 엔드포인트 정의:**
  - [x] **음식 주문:**
    - [x] `/api/orders/process-command/` (POST): AI 명령 처리 및 주문 로직
  - [ ] **공공/병원 안내:**
    - [ ] `/hospital/reserve` (POST): 병원 예약
    - [ ] `/public/inquiry` (POST): 민원 접수
  - [ ] **상점 연동:**
    - [ ] `/store/order` (POST): 키오스크 없는 상점 주문 접수
  - [ ] **교통/관광:**
    - [ ] `/transport/tickets` (POST): 티켓 예매
    - [ ] `/tourism/info` (GET): 관광 정보 조회
  - [ ] **배리어프리 지원:**
    - [ ] `/accessibility/voice` (POST): 음성 안내 요청
    - [ ] `/accessibility/visual` (POST): 시각 안내 요청
- [x] **각 엔드포인트별 요청/응답 데이터 모델 정의 및 구현**

## 3. 데이터베이스 설계 및 연동

- [x] **데이터베이스 종류 결정:** (예: PostgreSQL, MongoDB, SQLite 등) - **Railway 배포를 위해 PostgreSQL 사용 예정**
- [x] **데이터베이스 스키마 설계:** (예: 사용자, 주문, 상점, 메뉴 등)
- [x] **ORM/ODM 설정 및 연동**
  - `backend/config/settings.py`에서 `dj_database_url`을 사용하여 PostgreSQL 설정 완료.

## 4. 외부 서비스 연동 (Mock-up 또는 실제 연동)

- [ ] **결제 시스템 연동:** (예: PayPal 형식의 결제 처리 로직)
- [ ] **상점/메뉴 정보 연동:** (예: 주변 상점 및 메뉴 정보 조회)
- [ ] **AI 음성/텍스트 처리 연동:** (필요시)

## 5. 인증 및 보안

- [ ] **API 인증 방식 결정 및 구현:** (예: JWT, API Key 등)
- [x] **데이터 유효성 검사 및 에러 처리**
- [x] **CORS 설정**: `backend/config/settings.py`에 `corsheaders.middleware.CorsMiddleware` 추가 및 `CORS_ALLOWED_ORIGINS`에 `https://ai-agentic-kiosk.vercel.app` 추가, `CORS_ALLOW_ALL_ORIGINS = True` 설정 완료.

## 6. Railway 배포 준비

- [x] **Railway 배포 설정 파일 준비:**
  - `backend/Procfile` 생성 완료 (`web: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`)
- [x] **환경 변수 관리**
  - `backend/config/settings.py`에서 `DEBUG=False`, `ALLOWED_HOSTS=['.railway.app', 'ai-agentic-kiosk.vercel.app']` 설정 완료.
- [ ] **로깅 및 모니터링 설정**

## 7. 테스트

- [ ] **단위 테스트 및 통합 테스트 작성**
- [ ] **API 문서화**

---

### Railway 배포를 위한 다음 단계 (수동 작업 필요)

1.  **Railway 프로젝트 생성 및 GitHub 연결**:
    *   Railway 웹사이트에 로그인하여 "New Project"를 클릭합니다.
    *   GitHub 저장소를 연결하고, **"Configure"** 버튼을 클릭하여 **Root Directory**를 `backend/`로 설정합니다.
    *   배포를 시작합니다.
2.  **PostgreSQL 데이터베이스 추가**:
    *   Railway 프로젝트 대시보드에서 "Add" 버튼을 클릭하고 "Database" 섹션에서 "PostgreSQL"을 선택하여 추가합니다.
3.  **환경 변수 설정**: Railway 프로젝트 페이지의 "Variables" 탭에서 다음 환경 변수를 추가합니다.
    *   `SECRET_KEY`: Django `settings.py`에 있는 값을 복사하여 사용합니다.
    *   `CORS_ALLOWED_ORIGINS`: `https://ai-agentic-kiosk.vercel.app`
    *   `ALLOWED_HOSTS`: `.railway.app,ai-agentic-kiosk.vercel.app`
    *   `WEB_CONCURRENCY`: `1`
    *   `PYTHON_VERSION`: `3.12.x` (사용하는 Python 버전에 맞춰 설정)
4.  **마이그레이션 실행**: Railway 대시보드의 "Deployments" 탭에서 원격 셸에 접속하여 다음 명령어를 실행합니다.
    *   `python manage.py migrate`
    *   (선택 사항) `python manage.py createsuperuser`
5.  **정적 파일 수집**: 원격 셸에서 다음 명령어를 실행합니다.
    *   `python manage.py collectstatic --noinput`
6.  **프론트엔드 `package.json` 업데이트**:
    *   Railway 백엔드 배포가 완료되면, 백엔드 서비스의 "Settings" 탭에서 "Domain"을 확인하여 실제 URL을 얻습니다.
    *   `frontend/app/package.json` 파일의 `proxy` 값을 이 Railway 백엔드 URL로 변경합니다.
    *   이 변경사항을 프론트엔드 GitHub 저장소에 커밋하고 Vercel에 다시 배포합니다.