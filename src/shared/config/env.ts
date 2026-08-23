// `import.meta.env` is injected by Vite at build/dev time. It is `undefined`
// under plain Node execution (e.g. `tsx --test`), so every access here is
// optional-chained to keep these modules importable outside a Vite bundle.
export function readEnv(key: keyof ImportMetaEnv): string {
  return import.meta.env?.[key]?.trim() ?? '';
}
