/** No credentials here: Vite variables are public. Defaults retain the legacy behaviour. */
type Env = Record<string, string | undefined>;
const environment: Env =
  (import.meta as unknown as { env?: Env }).env ?? {};
export function options(env: Env = environment) {
  return {
    storyPal: env.VITE_QSTORY_STORYPAL_ENABLED === 'true',
    childSpeech: env.VITE_QSTORY_CHILD_SPEECH_ENABLED === 'true',
    forceBatch: env.VITE_QSTORY_CHILD_SPEECH_ENABLED === 'true'
      && env.VITE_QSTORY_COMPANION_BATCH === 'true',
    ageBand: ['5-6', '7-9'].includes(env.VITE_QSTORY_CHILD_AGE_BAND ?? '')
      ? env.VITE_QSTORY_CHILD_AGE_BAND! : 'UNKNOWN',
  };
}
