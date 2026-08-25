// features/narrate-story의 preloadFixedNarration과 같은 모양(URL별 중복 방지 캐시 +
// force-cache fetch)을 쓰되, 이미지는 한 번에 훨씬 많은 장면이 몰릴 수 있어 동시 요청 개수를
// 제한한다 - 그렇지 않으면 브라우저 연결 풀을 이미지 프리페치가 다 차지해서 정작 지금 보여줘야
// 할 리소스(다음 오디오, 챕터 전환 자체)가 뒤로 밀릴 수 있다.
const MAX_CONCURRENT_PRELOADS = 10;

const preloadCache = new Map<string, Promise<void>>();

function preloadOne(uri: string): Promise<void> {
  const cached = preloadCache.get(uri);
  if (cached) {
    return cached;
  }
  const pending = fetch(uri, { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`preload failed: ${response.status}`);
      }
    })
    .catch(() => {
      preloadCache.delete(uri);
    });
  preloadCache.set(uri, pending);
  return pending;
}

/** 최대 MAX_CONCURRENT_PRELOADS개까지만 동시에 진행하며 나머지는 청크 단위로 뒤이어 처리한다. */
export async function preloadImages(uris: readonly string[]): Promise<void> {
  const uniqueUris = [...new Set(uris)];
  for (let offset = 0; offset < uniqueUris.length; offset += MAX_CONCURRENT_PRELOADS) {
    const chunk = uniqueUris.slice(offset, offset + MAX_CONCURRENT_PRELOADS);
    await Promise.all(chunk.map(preloadOne));
  }
}
