# 우경 · 소영 모바일 청첩장

GitHub Pages로 제공하는 정적 모바일 청첩장입니다. 공개 화면은 브라우저에서 동작하고, 연락처·계좌·참석 여부·축하 메시지·관리 기능은 Supabase를 사용합니다. 하객 사진 원본은 Google Drive, 표시용 썸네일은 Supabase Storage에 보관합니다.

## 화면과 주소

| 화면 | 경로 | 용도 |
| --- | --- | --- |
| 청첩장 | `/` | 예식 안내, 갤러리, 연락처, 계좌, 축하 메시지, 참석 여부 |
| 관리자 | `/admin/` | 로그인 후 청첩장 데이터·갤러리·참석 여부 관리 |
| 오늘의 순간 | `/moments/` | 하객 사진이 떠다니는 공개 사진 공간 |
| 사진 올리기 | `/upload/` | 호환용 주소. `/moments/?upload=1`의 업로드 패널로 자동 이동 |
| 개인정보처리방침 | `/privacy/` | 하객 사진 서비스 안내 |
| 서비스 약관 | `/terms/` | 하객 사진 업로드 약관 |

## 청첩장 기능

- 첫 화면 일러스트·카운트다운·스크롤 연출
- 예식 장소, 약도, 교통 안내, 지도 앱 길찾기와 주소 복사
- 신랑·신부 및 양가 혼주 연락처: 전화, 문자, 번호 복사
- 양측 아코디언 계좌 정보와 계좌번호 복사
- 카카오톡 공유와 링크 복사
- 갤러리 자동 슬라이드, 전체 사진 보기, 확대 팝업·좌우 이동
- 축하 메시지 작성·수정·삭제, 색상과 아이콘 선택, 3개 단위 페이지 표시
- 참석 여부 전달: 참석/불참, 인원, 동일 브라우저의 기존 응답 수정

## 갤러리 운영 원칙

메인 청첩장 갤러리는 속도와 화질을 위해 **저장소 로컬 이미지가 기본**입니다.

- 원본: `assets/photos/`
- 표시용: `assets/photos/display/`
- 썸네일: `assets/photos/thumbs/`
- 목록: `assets/photos.json`
- 일괄 변환: `scripts/generate-thumbnails.ps1`

관리자에서 로컬 사진의 순서를 드래그하여 저장할 수 있습니다. 이 순서는 `wedding_site_settings.gallery_order`에 저장되며 `photos.json`의 기본 순서보다 우선합니다.

Supabase 갤러리 업로드 기능은 필요할 때만 관리자에서 켭니다. 현재처럼 많은 사진을 빠르게 보여줘야 할 때는 꺼 둔 채 로컬 갤러리를 사용하는 것이 권장됩니다.

## 관리자 `/admin/`

Supabase Auth 로그인과 `wedding_admins` 관리자 권한이 모두 필요합니다.

관리 가능한 내용:

- 신랑·신부·혼주 이름과 휴대전화 번호
- 은행명, 예금주, 계좌번호. **은행명을 비우면 해당 계좌는 공개 청첩장에서 숨겨집니다.**
- 계좌 정보 영역 사용 여부 (`accounts_enabled`)
- 로컬 갤러리 순서 및 Supabase 갤러리 저장소 사용 여부
- Supabase 갤러리 사진 업로드·표시·삭제
- 참석 여부 전체 집계와 원본(`ksy`)·복제(`kwk`) 링크 필터
- Google Drive 연결 상태와 OAuth 재연결

관리자 SQL은 다음 순서로 실행합니다.

1. `supabase/sql/admin_portal.sql`
2. `supabase/sql/admin_authorize_soyoung.sql` — 실제 로그인 이메일에 맞게 수정
3. 연락처·계좌가 아직 없다면 `supabase/sql/wedding_directory.sql`

## 참석 여부·축하 메시지

| 기능 | 테이블 | Edge Function |
| --- | --- | --- |
| 참석 여부 | `wedding_rsvps` | 브라우저에서 RLS 범위 내 저장 |
| 축하 메시지 생성 | `guestbook_entries` | `guestbook-create` |
| 축하 메시지 수정 | `guestbook_entries` | `guestbook-update` |
| 축하 메시지 삭제 | `guestbook_entries` | `guestbook-delete` |
| AI 문구 제안(사용 시) | - | `guestbook-ai` |

관련 SQL: `supabase/sql/guestbook.sql`, `guestbook_appearance_migration.sql`, `wedding_rsvp.sql`, `wedding_rsvp_reset_for_site_tracking.sql`.

## 하객 사진: Moments + Upload

`/moments/`는 공개 사진 공간이며, 하단 **사진 올리기**를 누르면 동일한 화면 위에 업로드 패널이 열립니다.

- JPG, PNG, WebP만 가능하며 사진당 최대 25MB, 한 번에 최대 10장
- 브라우저에서 썸네일을 만들고 사진을 **한 장씩 순차 업로드**하여 대용량 일괄 전송을 피함
- 진행 중에는 사진 번호, 전체 퍼센트, 진행 바를 표시
- 페이지 이탈 시 브라우저 기본 이탈 확인을 표시
- 성공한 사진마다 로컬 진행 상태를 저장. 중간 이탈 후 다시 사진을 선택하면 이미 완료된 파일은 건너뛰고 남은 파일만 업로드
- 원본은 Google Drive 폴더, 공개 표시용 썸네일은 `wedding-guest-thumbnails` 버킷, 메타데이터는 `wedding_guest_photos`에 저장
- 사진 벽은 최근 공개 사진 중 최대 20장을 무작위로 보여주고 15초마다 새 사진을 확인

필수 SQL:

1. `supabase/sql/wedding_guest_photos.sql`
2. `supabase/sql/wedding_google_drive_oauth.sql`
3. `supabase/sql/wedding_guest_photo_uploads.sql`

업로드를 열려면 `wedding_guest_photo_settings.uploads_enabled`를 `true`로 설정해야 합니다. 원본과 복제 청첩장은 `site_key`로 각각 구분됩니다.

### Google Drive 연결

Supabase Edge Function Secrets에 아래 값을 등록합니다.

```text
GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET
```

Google Cloud에서 Drive API를 활성화하고 OAuth 동의 화면·리디렉션 URI를 설정한 뒤, 관리자 화면의 Google Drive 연결 버튼으로 권한을 부여합니다. Google OAuth 앱이 **테스트 중**이면 refresh token이 만료될 수 있으므로 예식 전 주기적으로 관리자에서 재연결해야 합니다.

필요 함수 배포 예시:

```powershell
npx supabase functions deploy guest-photo-upload
npx supabase functions deploy google-drive-authorize
npx supabase functions deploy google-drive-oauth-callback
```

## Supabase 보안 원칙

`config.js`의 publishable/anon 키는 정적 웹에서 공개되어도 되는 키입니다. 단, RLS 정책이 적용되어 있어야 합니다.

아래 값은 절대로 GitHub나 브라우저 코드에 넣지 않습니다.

- `service_role` / secret key
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `GUESTBOOK_PASSWORD_PEPPER`

비밀값은 Supabase Edge Function Secrets에서만 사용하고, 함수 내부에서는 `Deno.env.get(...)`로 읽습니다.

## 배포 시 캐시 갱신 규칙 (필수)

GitHub Pages CDN과 모바일·카카오톡·삼성 인터넷 브라우저는 이전 HTML, CSS, JavaScript를 오래 보관할 수 있습니다. QR 코드 주소를 이미 전달한 뒤에도 최신 화면이 열리도록, **화면 동작·스타일을 변경해 배포할 때는 아래 항목을 반드시 함께 갱신합니다.**

1. 루트의 [`version.json`](./version.json)에서 `version` 값을 새 값으로 변경합니다. 예: `20260910.2`.
2. 변경한 HTML의 로컬 CSS·JavaScript URL에 같은 버전 쿼리를 붙입니다. 예: `./styles/style.css?v=20260910.2`, `./scripts/main.js?v=20260910.2`.
3. 각 페이지의 `version-check.js?v=...` 값도 같은 버전으로 변경합니다.
4. `git push` 후 모바일에서 QR 원래 주소로 접속해 자동으로 `__release=새버전`이 붙으며 한 번 새로 열리는지 확인합니다.

`version-check.js`는 매 접속마다 `version.json`을 캐시 없이 확인합니다. 버전이 다르면 QR 주소의 기본 경로는 바꾸지 않고 `__release` 값만 붙여 최신 파일 묶음을 다시 불러옵니다. 이 규칙을 생략하면 PC에는 새 화면이 보이는데 모바일에는 이전 CSS/JS가 남는 문제가 다시 발생할 수 있습니다.

## 배포·개발 명령

```powershell
# 로컬 정적 사이트 확인
npx serve . -l 5500

# 축하 메시지 관련 함수
npx supabase functions deploy guestbook-create --no-verify-jwt
npx supabase functions deploy guestbook-update --no-verify-jwt
npx supabase functions deploy guestbook-delete --no-verify-jwt
npx supabase functions deploy guestbook-ai --no-verify-jwt

# GitHub Pages 반영
git add .
git commit -m "설명"
git push origin main
```

## 주요 설정 파일

- `config.js`: 사이트 키, 예식 일시, 공유 문구, Supabase 공개 설정
- `supabase/config.toml`: Supabase 로컬·함수 설정
- `supabase/sql/`: 테이블, RLS, 초기 데이터 SQL
- `supabase/functions/`: 공개 요청을 안전하게 처리하는 Edge Functions

두 청첩장 저장소는 요청이 있을 때만 동기화합니다. 기본 작업 대상은 이 저장소 `ksy_kwk_wed`입니다.
