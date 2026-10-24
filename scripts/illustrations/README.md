# 삽화 다시 만들기 (스타일 01 · Higgsfield)

「헨젤과 그레텔」 그림 50장(장면 40 · 행동 전개 4 · 시도 장면 막힘 6)을 스타일 01로 다시 만들어 바꾸는 순서다. 모델은 Higgsfield **GPT Image 2.5 Flare**(`marketing-studio/image/flare`, 16:9 · **2k · high**). 공통 프롬프트는 디자이너 문서(노션 "삽화 제작 방법")와 같은 내용이다.

**돈 먼저**: 2k·high 한 장 약 $0.275(5.5크레딧), 4k는 그 2~5배. 기본은 **장면당 후보 1장·2k**(50장 ≈ $14)다. 앱은 1920×1080으로 줄여 쓰니 4k는 필요 없다. 후보를 늘리거나 4k로 돌리기 전에 장수와 금액을 먼저 말하고 확인받는다(10/21: 5달러 충전에 후보 2장·4k 시험을 돌려 모자랐다).

## 0. 준비

- **참고 그림 폴더**(저장소 밖, 지금은 `Q-story/docs/삽화/style-01-refs/`). 파일 이름으로 찾는다. 원본은 피그마 「삽화」 파일의 등장인물 섹션 3면도 - Figma MCP `download_assets`로 받는다.
  - 필수: `gretel-sheet.png`, `hansel-sheet.png`
  - 인물 시트: `father-sheet`, `stepmother-sheet`, `witch-sheet` (그 인물이 나오는 장면에만 붙음. 없으면 `style-01.mjs`의 글 설명만 씀)
  - 선택: `background-1.png`, `background-2.png` (배경·분위기 참고 - 모든 장면에 붙음)
- **API 키**: Higgsfield 콘솔에서 만든 키를 환경변수로. 저장소·대화에 붙여 넣지 않는다. 이 앱의 `.env`(git 제외)에 `HF_CREDENTIALS=id:secret`로 두면 `set -a && . ./.env`로 읽을 수 있다.
  ```bash
  export HF_API_KEY_ID=...   HF_API_KEY_SECRET=...     # 또는 HF_CREDENTIALS=id:secret
  ```

## 0-1. 실시간 삽화도 같은 시트를 쓴다

앱이 실시간으로 만드는 그림(새 선택지 전개 그림, 시도 장면 막힘 그림)은 백엔드 `RealtimeImageService`가 같은 Higgsfield 모델·같은 공통
프롬프트(`be/.../realtime-image/style-01-common.txt`, 여기 `style-01.mjs`의 COMMON_TEMPLATE와 같은 글)·같은 인물 시트로 만든다.
시트는 버킷 `qstory-story-images/<slug>/references/<인물>-sheet.png`에서 읽으므로, 시트를 바꾸면 여기도 다시 올린다:

```bash
# 예: 그레텔 시트 교체 (be/.env의 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
curl -X POST "$SUPABASE_URL/storage/v1/object/qstory-story-images/hansel-gretel/references/gretel-sheet.png" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "content-type: image/png" -H "x-upsert: true" --data-binary @gretel-sheet.png
```

공통 프롬프트를 고치면 `style-01.mjs`와 백엔드 `style-01-common.txt`를 함께 고친다. 상한·해상도는 백엔드 `qstory.realtime-image`
(질문 지점·세션당 3장, 2k·high)다.

## 1. 프롬프트 만들기 (API 안 부름)

```bash
npm run art:jobs
```

`build-output/illustrations/hansel-gretel/jobs.json`에 장면별 SCENE·PROPS·COMPOSITION·BACKGROUND·LIGHTING이 채워진 프롬프트가 생긴다. 공통 문구·인물 외형·장소·조명은 `style-01.mjs`에서 고친다.

- **장면 연출 메모가 먼저다** (`staging-<story>.mjs`): 그림마다 누가 어디에 있는지, 누구 몰래 하는지(숨어서 엿듣기, 부모 뒤에서 몰래 떨어뜨리기), 사람 수, 소품 개수·상태(빵 한 조각, 가방 유무)를 영어로 적는다. 메모가 없는 그림이 있으면 `art:jobs`가 멈춘다. 동화 문장만 넘기면 모델이 모두를 한 줄로 세워 그린다(10/24 QA).
- 장면을 새로 만들거나 대본을 바꾸면 메모부터 고친다. 방마다 배경이 다르면 `BACKGROUNDS`에 장소를 따로 둔다 - 부엌 배경을 쓰면 다른 방에도 창살·오븐이 나온다.

- 구도 규칙: 앱에서는 그림 **아래 40%**를 자막·대화창이 덮는다. 그래서 얼굴·손·중요한 행동은 위~가운데에 두도록 모든 장면에 넣었다(`COMPOSITION_RULE`).

## 2. 후보 만들기

```bash
# 먼저 몇 장만, 무엇을 보낼지 확인 (API 안 부름)
npm run art:generate -- --refs <참고그림폴더> --only home-table,white-bird --dry-run
# 시험으로 2장면 × 후보 1장 (≈ $0.55)
npm run art:generate -- --refs <참고그림폴더> --only home-table,white-bird
# 전체 (50장면 × 1장 ≈ $14)
npm run art:generate -- --refs <참고그림폴더>
# 마음에 안 드는 장면만 후보 하나 더 (그 장면은 2.png가 생긴다)
npm run art:generate -- --refs <참고그림폴더> --only witch-reveal --variants 2
```

- 기본값은 후보 1장, 2k, high. `--variants`, `--resolution 4k`는 꼭 필요할 때만, 금액을 말한 뒤에 쓴다.
- 결과: `build-output/illustrations/hansel-gretel/images/<장면>/<후보번호>.png`, 요청 기록은 `results.json`.
- 이미 받은 후보는 건너뛴다. 끊기면 같은 명령을 다시 돌리면 된다(같은 요청은 Idempotency-Key로 중복 과금 없음).
- Higgsfield 결과 주소는 7일만 보관돼서 바로 내려받는다.
- 동시 요청 기본 3건(`--concurrency`), 몇 장만 하려면 `--limit N`.
- 프롬프트 상한 5,000자: `art:jobs`가 넘는 장면을 알려 준다. 넘으면 `style-01.mjs`의 장면 칸(STORY 상한·배경 설명)을 줄인다.

## 3. 고르기

```bash
npm run art:review
```

`review.html`(지금 그림 ↔ 후보, 장면 대사, 프롬프트)을 브라우저로 열어 보고, 같은 폴더 `picks.json`에 고른 후보 번호를 적는다. 바꾸지 않을 장면은 `null`.

품질 확인은 `docs/guides/품질-QA-체크리스트.md`의 "1. 삽화"를 쓴다.

### 기기별로 보기

```bash
npm run art:devices                 # 앱에 들어간 그림
npm run art:devices -- --candidates # 새 후보(images/<장면>/1.png)
```

`device-preview/index.html`에 휴대폰 가로(19.5:9)·노트북(1.9:1)·아이패드 가로(4:3) 틀로 잘라 보여 주고, 상단 버튼 줄·자막(빨강), 질문 카드(주황), 대화창(파랑 아래)을 겹친다. 얼굴·동물·중요한 행동이 빨강 안에 있거나 틀 밖으로 잘리면 고른 후보를 바꾸거나 다시 그린다.

## 4. 앱에 넣기

```bash
npm run art:promote -- --dry-run     # 바뀔 파일 확인
npm run art:promote
npm run content:generate && npm run content:check
node scripts/upload-story-assets-to-supabase.mjs --story hansel-gretel --kind images
npm run content:import
```

- 그림은 1920×1080 WebP로 맞춰 `<기존 이름>-s1.webp`로 저장된다. 이름이 바뀌어야 브라우저·CDN 캐시가 새 그림을 받는다.
- `assets.json`의 파일·integrity와 `visual-provenance.yaml`(프롬프트·모델·inputHash, `approvedBy`는 비움)이 함께 바뀐다.
- 예전 그림 파일은 지우지 않는다. 되돌리려면 `assets.json`만 되돌리고 다시 올린다.
