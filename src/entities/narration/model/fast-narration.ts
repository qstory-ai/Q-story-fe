export async function audioReadyWithin<T>(
  pendingAudio: Promise<T | null>,
  waitMillis: number,
): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      pendingAudio.catch(() => null),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(resolve, Math.max(0, waitMillis), null);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
