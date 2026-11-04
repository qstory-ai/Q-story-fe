// 삽화 스크립트 공통 - 명령줄 인자 읽기. 각 스크립트가 같은 네 줄을 복사해 쓰던 것을 모았다.
const args = process.argv.slice(2);

/** `--name value` 꼴의 값. 없으면 fallback. */
export const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

/** `--name` 스위치가 있는지. */
export const hasFlag = (name) => args.includes(name);
