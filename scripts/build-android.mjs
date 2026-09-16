#!/usr/bin/env node
/**
 * 갤럭시탭용 APK 빌드 - `npm run android:apk`(debug) / `npm run android:apk:release`.
 *
 * 하는 일:
 *  1. ANDROID_HOME(또는 android/local.properties의 sdk.dir)이 있는지 확인하고, 없으면 어디를
 *     보면 되는지 알려주고 멈춘다(Gradle이 내는 긴 스택트레이스 대신).
 *  2. android/gradlew assembleDebug|assembleRelease 를 실행한다.
 *  3. 나온 APK를 build-output/ 에 날짜·버전이 붙은 이름으로 복사한다 - 결과물을 한곳에서 찾게.
 *
 * 선행 조건: `npm run cap:sync`(package.json의 android:apk 스크립트가 먼저 돌린다).
 * release는 서명 키가 있어야 설치 가능하다 - android/keystore.properties 가 있으면
 * app/build.gradle의 signingConfigs가 그걸 읽는다(docs/native-build.md 참고). 없으면
 * 서명되지 않은 release APK가 나오며, 그건 기기에 설치되지 않는다.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');
const variant = (process.argv[2] ?? 'debug').toLowerCase();
if (!['debug', 'release'].includes(variant)) {
  console.error(`알 수 없는 variant: ${variant} (debug | release)`);
  process.exit(2);
}

// --- 1. SDK 위치 확인 -------------------------------------------------------------
function sdkDirFromLocalProperties() {
  const file = path.join(androidDir, 'local.properties');
  if (!existsSync(file)) return null;
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('sdk.dir='));
  return line ? line.slice('sdk.dir='.length).replace(/\\\\/g, '\\').replace(/\\:/g, ':').trim() : null;
}
const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || sdkDirFromLocalProperties();
if (!sdkDir || !existsSync(sdkDir)) {
  console.error(
    [
      'Android SDK를 찾지 못했어요.',
      '  - 환경변수 ANDROID_HOME 을 SDK 경로로 설정하거나',
      '  - android/local.properties 에 sdk.dir=<경로> 를 적어 주세요.',
      '  이 PC의 기본 설치 경로: C:\\Android\\sdk  (scripts/setup-android-sdk.ps1 로 설치)',
    ].join('\n'),
  );
  process.exit(1);
}
process.env.ANDROID_HOME = sdkDir;

// --- 2. Gradle -------------------------------------------------------------------
const isWindows = process.platform === 'win32';
// cwd를 android/로 두고 상대 이름으로 부른다 - 절대 경로에 공백이 있으면(OneDrive 폴더 등)
// shell:true인 spawn이 경로를 첫 공백에서 잘라 "'C:\Users\...' is not recognized"로 실패한다.
// '.\' 를 붙여야 cmd.exe가 PATH가 아니라 cwd에서 찾는다(NoDefaultCurrentDirectoryInExePath 환경 포함).
const gradlew = isWindows ? '.\\gradlew.bat' : './gradlew';
const task = variant === 'release' ? 'assembleRelease' : 'assembleDebug';
console.log(`> ${path.join(androidDir, gradlew)} ${task}  (ANDROID_HOME=${sdkDir})`);
// shell:true엔 인자 배열 대신 한 문자열을 준다(Node 24 DEP0190 - 배열 인자는 이스케이프 없이 이어 붙는다).
const result = spawnSync(`${gradlew} ${task} --no-daemon`, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
if (result.status !== 0) {
  console.error(`Gradle 빌드 실패 (exit ${result.status})`);
  process.exit(result.status ?? 1);
}

// --- 3. 결과물 복사 -----------------------------------------------------------------
const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', variant);
const apkName = variant === 'release'
  ? (existsSync(path.join(apkDir, 'app-release.apk')) ? 'app-release.apk' : 'app-release-unsigned.apk')
  : 'app-debug.apk';
const apkPath = path.join(apkDir, apkName);
if (!existsSync(apkPath)) {
  console.error(`APK를 찾지 못했어요: ${apkPath}`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const outDir = path.join(root, 'build-output');
mkdirSync(outDir, { recursive: true });
const outName = `qstory-tablet-${pkg.version}-${stamp}-${variant}${apkName.includes('unsigned') ? '-unsigned' : ''}.apk`;
const outPath = path.join(outDir, outName);
copyFileSync(apkPath, outPath);
console.log(`\n✔ APK: ${outPath}`);
if (apkName.includes('unsigned')) {
  console.log('  (서명되지 않은 release APK - android/keystore.properties 를 만들면 서명본이 나와요. docs/native-build.md 참고)');
} else if (variant === 'debug') {
  console.log('  갤럭시탭에 설치: USB 연결 후  adb install -r "' + outPath + '"  또는 파일을 옮겨 직접 설치(출처를 알 수 없는 앱 허용).');
}
