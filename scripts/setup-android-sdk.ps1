# Installs the Android SDK pieces needed for the Galaxy Tab (APK) build without Android Studio.
# (Windows PowerShell 5.1+; messages are ASCII on purpose - PS 5.1 reads BOM-less scripts as ANSI.)
#
#   powershell -ExecutionPolicy Bypass -File scripts/setup-android-sdk.ps1
#
# What it does:
#   1. Puts the command-line tools at C:\Android\sdk\cmdline-tools\latest (downloads the zip if missing).
#   2. Pre-accepts the SDK licenses by writing the license hash files (the interactive
#      `sdkmanager --licenses` prompt does not read piped input reliably on Windows).
#   3. Installs platform-tools (adb), platforms;android-36, build-tools;36.0.0 - matching
#      android/variables.gradle compileSdkVersion.
#   4. Sets the user env var ANDROID_HOME, adds platform-tools to PATH, writes android/local.properties.
#
# Prereq: JDK 17+ on JAVA_HOME (this PC has Eclipse Adoptium JDK 21). Size: ~1.5 GB.
# Re-running is safe - existing pieces are skipped.
param(
  [string]$SdkRoot = 'C:\Android\sdk',
  [string]$Platform = 'android-36',
  [string]$BuildTools = '36.0.0',
  # Latest zip from https://developer.android.com/studio#command-line-tools-only - bump when it changes.
  [string]$ToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip'
)
$ErrorActionPreference = 'Stop'

if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
  throw "JAVA_HOME does not point at a JDK. Install JDK 17+ and set JAVA_HOME."
}

$toolsDir = Join-Path $SdkRoot 'cmdline-tools\latest'
$sdkmanager = Join-Path $toolsDir 'bin\sdkmanager.bat'
if (-not (Test-Path $sdkmanager)) {
  New-Item -ItemType Directory -Force $SdkRoot | Out-Null
  $zip = Join-Path (Split-Path $SdkRoot) 'cmdline-tools.zip'
  if (-not (Test-Path $zip)) {
    Write-Host "Downloading command-line tools: $ToolsUrl"
    Invoke-WebRequest -Uri $ToolsUrl -OutFile $zip -UseBasicParsing
  }
  $tmp = Join-Path (Split-Path $SdkRoot) 'cmdline-tools-unzip'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp
  # The zip contains a 'cmdline-tools' folder; sdkmanager requires the 'cmdline-tools/latest' layout.
  New-Item -ItemType Directory -Force (Split-Path $toolsDir) | Out-Null
  Move-Item -Path (Join-Path $tmp 'cmdline-tools') -Destination $toolsDir
  Remove-Item -Recurse -Force $tmp
}

$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot

# License acceptance = presence of these hash files (what `sdkmanager --licenses` writes after you
# answer y). Hashes are the well-known values for the current Android SDK license texts.
$licenseDir = Join-Path $SdkRoot 'licenses'
New-Item -ItemType Directory -Force $licenseDir | Out-Null
$licenses = @{
  'android-sdk-license'         = @('8933bad161af4178b1185d1a37fbf41ea5269c55', 'd56f5187479451eabf01fb78af6dfcb131a6481e', '24333f8a63b6825ea9c5514f83c2829b004d1fee')
  'android-sdk-preview-license' = @('84831b9409646a918e30573bab4c9c91346d8abd')
  'android-sdk-arm-dbt-license' = @('859f317696f67ef3d7f30a50a5560e7834b43903')
  'google-gdk-license'          = @('33b6a2b64607f11b759f320ef9dff4ae5c47d97a')
  'intel-android-extra-license' = @('d975f751698a77b662f1254ddbeed3901e976f5a')
}
foreach ($name in $licenses.Keys) {
  # Files must be LF-separated with a leading newline; sdkmanager compares each line as a hash.
  $content = "`n" + ($licenses[$name] -join "`n")
  [System.IO.File]::WriteAllText((Join-Path $licenseDir $name), $content, (New-Object System.Text.UTF8Encoding($false)))
}
Write-Host "Licenses pre-accepted in $licenseDir"

Write-Host "Installing: platform-tools, platforms;$Platform, build-tools;$BuildTools"
& $sdkmanager --sdk_root="$SdkRoot" "platform-tools" "platforms;$Platform" "build-tools;$BuildTools"
if ($LASTEXITCODE -ne 0) { throw "sdkmanager failed (exit $LASTEXITCODE)" }
foreach ($required in @("platform-tools\adb.exe", "platforms\$Platform\android.jar", "build-tools\$BuildTools\aapt2.exe")) {
  if (-not (Test-Path (Join-Path $SdkRoot $required))) { throw "Missing after install: $required" }
}

# User-level env vars - apply to new terminals; the current session was set above.
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $SdkRoot, 'User')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$platformTools = Join-Path $SdkRoot 'platform-tools'
if ($userPath -notlike "*$platformTools*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;$platformTools", 'User')
}

# Gradle reads the SDK path from this file. Backslashes/colons are escaped per .properties rules.
$repoRoot = Split-Path -Parent $PSScriptRoot
$localProps = Join-Path $repoRoot 'android\local.properties'
# .NET regex replacement strings treat backslash literally, so '\\' here inserts exactly two.
$escaped = ($SdkRoot -replace '\\', '\\') -replace ':', '\:'
"sdk.dir=$escaped" | Out-File -FilePath $localProps -Encoding ascii
Write-Host "Wrote $localProps"

Write-Host ""
Write-Host "Done. ANDROID_HOME=$SdkRoot"
Write-Host "Next: npm run android:apk   (APK lands in build-output/)"
