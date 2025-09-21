param(
  [string]$ProjectRoot = "D:\Android_Home\AndroidStudioProjects\Compose_Study1\MMProject",
  [string]$ModuleName  = "MMProject"   # 예: app 또는 MMProject
)

# 1) gradlew 존재 확인
$gradlew = Join-Path $ProjectRoot "gradlew.bat"
if (-not (Test-Path $gradlew)) {
  Write-Error "gradlew.bat 이 $ProjectRoot 아래에 없습니다. ProjectRoot 경로를 확인하세요."
  exit 1
}

# 2) 빌드 실행
Set-Location $ProjectRoot
Write-Host "▶️ AAB 빌드 시작: $ProjectRoot :: module :$ModuleName:"
& $gradlew "clean" ":$ModuleName:bundleRelease" "--no-daemon" "--stacktrace"
if ($LASTEXITCODE -ne 0) {
  Write-Error "Gradle 빌드 실패. 위 에러 로그를 확인하세요."
  exit $LASTEXITCODE
}

# 3) 산출물 확인 및 안내
$aabPath = Join-Path $ProjectRoot "$ModuleName\build\outputs\bundle\release"
if (Test-Path $aabPath) {
  $aabFiles = Get-ChildItem -Path $aabPath -Filter "*.aab" | Sort-Object LastWriteTime -Descending
  if ($aabFiles.Count -gt 0) {
    Write-Host "✅ 빌드 성공! 생성된 AAB:"
    $aabFiles | ForEach-Object { Write-Host " - $($_.FullName)" }
    exit 0
  }
}

Write-Warning "빌드는 성공했지만 AAB 파일을 찾지 못했습니다. 모듈명 또는 출력 경로를 확인하세요."
exit 0
