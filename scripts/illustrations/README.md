# 삽화 다시 만들기 (스타일 01 · Higgsfield)

「헨젤과 그레텔」 그림 50장(장면 40 · 행동 전개 4 · 시도 장면 막힘 6)을 스타일 01 "Crisp Characters × Soft Painterly Backgrounds"로 다시 만들어 바꾸는 순서다. 모델은 Higgsfield **GPT Image 2.5 Flare**(`marketing-studio/image/flare`, 16:9 · 4k · high).

## 0. 준비

- **참고 그림 폴더**(저장소 밖, 예: `docs/삽화/style-01-refs/`). 파일 이름으로 찾는다.
  - 필수: `gretel-sheet.png`, `hansel-sheet.png` (캐릭터 시트)
  - 선택: `background-1.png`, `background-2.png` (배경·분위기 참고 - 모든 장면에 붙음)
  - 선택: `father-sheet`, `stepmother-sheet`, `witch-sheet` (있으면 그 인물이 나오는 장면에만 붙음. 없으면 `style-01.mjs`의 글 설명만 씀)
- **API 키**: Higgsfield 콘솔에서 만든 키를 환경변수로. 저장소·대화에 붙여 넣지 않는다.
  ```bash
  export HF_API_KEY_ID=...   HF_API_KEY_SECRET=...
  ```

## 1. 프롬프트 만들기 (API 안 부름)

```bash
npm run art:jobs
```

`build-output/illustrations/hansel-gretel/jobs.json`에 장면별 STORY·COMPOSITION·BACKGROUND·LIGHTING이 채워진 프롬프트가 생긴다. 공통 문구·인물 외형·장소·조명은 `style-01.mjs`에서 고친다.

- 구도 규칙: 앱에서는 그림 **아래 40%**를 자막·대화창이 덮는다. 그래서 얼굴·손·중요한 행동은 위~가운데에 두도록 모든 장면에 넣었다(`COMPOSITION_RULE`).

## 2. 후보 만들기

```bash
# 먼저 몇 장만, 무엇을 보낼지 확인
npm run art:generate -- --refs <참고그림폴더> --only home-table,white-bird --dry-run
# 시험으로 2장면 × 후보 2장
npm run art:generate -- --refs <참고그림폴더> --only home-table,white-bird --variants 2
# 전체 (50장면 × 2장 = 100건)
npm run art:generate -- --refs <참고그림폴더> --variants 2
```

- 결과: `build-output/illustrations/hansel-gretel/images/<장면>/<후보번호>.png`, 요청 기록은 `results.json`.
- 이미 받은 후보는 건너뛴다. 끊기면 같은 명령을 다시 돌리면 된다(같은 요청은 Idempotency-Key로 중복 과금 없음).
- Higgsfield 결과 주소는 7일만 보관돼서 바로 내려받는다.
- 동시 요청 기본 3건(`--concurrency`), 몇 장만 하려면 `--limit N`.

## 3. 고르기

```bash
npm run art:review
```

`review.html`(지금 그림 ↔ 후보, 장면 대사, 프롬프트)을 브라우저로 열어 보고, 같은 폴더 `picks.json`에 고른 후보 번호를 적는다. 바꾸지 않을 장면은 `null`.

품질 확인은 `docs/guides/품질-QA-체크리스트.md`의 "1. 삽화"를 쓴다.

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
