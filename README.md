# GitHub Pages 모바일 청첩장

## 포함 기능
- 저장소 사진 기반 자동 슬라이드
- 갤러리 확대 보기
- 신랑/신부 전화하기 버튼 (`tel:`)
- 신랑/신부 문자하기 버튼 (`sms:`)
- 주소 복사 버튼
- 계좌번호 복사 버튼

## 모바일 호환
- `tel:` 링크는 Android/iPhone에서 전화 앱으로 연결됩니다.
- `sms:` 링크는 문자 앱으로 연결됩니다.
- 복사 버튼은 클립보드 API를 사용하고, 제한 환경에서는 복사 안내창으로 대체됩니다.



SUPABASE_ANON_KEY는 GitHub public 저장소에 들어가도 괜찮습니다.

Supabase 공식 문서 기준으로 publishable / anon 계열 키는 브라우저, 모바일 앱, 공개
소스코드에서 사용 가능한 키입니다. 대신 전제는 RLS(Row Level Security) 를 제대로 걸어두는 것입니다.

반대로 service_role / secret key는 절대 브라우저나 GitHub에 넣으면 안 됩니다.

이 키는 RLS를 우회하므로 Edge Functions 비밀값으로만 써야 합니다.
Supabase는 이런 비밀값을 Edge Functions 환경변수(Deno.env.get(...))로 관리하라고 안내합니다.

그리고 정적 사이트(GitHub Pages)에서는 anon key를 “숨길 방법”이 사실상 없습니다.

빌드 타임 환경변수로 넣든, config.js로 분리하든, 최종적으로 브라우저에 내려가면 사용자가 볼 수 있습니다.
그래서 숨기는 게 아니라, anon key + RLS + Edge Functions 구조로 안전하게 설계하는 게 정답입니다.
npx supabase functions deploy guestbook-create --no-verify-jwt
npx supabase functions deploy guestbook-update --no-verify-jwt
npx supabase functions deploy guestbook-delete --no-verify-jwt
npx supabase functions deploy guestbook-ai --no-verify-jwt
npx serve . -l 5500

## 연락처·계좌 관리

Supabase SQL Editor에서 `supabase/sql/wedding_directory.sql`을 한 번 실행하세요. 이후 `wedding_contacts`, `wedding_accounts` 테이블의 행을 추가·수정하면 GitHub Pages를 다시 배포하지 않아도 연락처와 계좌 정보가 바뀝니다. `display_order`는 표시 순서이며, `is_visible`을 끄면 데이터를 보존한 채 화면에서 숨길 수 있습니다. 공개 사이트는 읽기만 가능하고, 내용 수정은 Supabase Dashboard에서만 할 수 있습니다.
