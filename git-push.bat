@echo off
REM === Git 자동 Push 스크립트 ===

REM 1. 작업 디렉토리 이동
cd /d "D:\User\Documents\measure-master-site"

REM 2. 현재 상태 확인
echo ==========================
echo 현재 Git 상태 확인...
echo ==========================
git status

REM 3. 최신 원격 가져오기 (충돌 예방)
echo ==========================
echo 원격 main 브랜치와 동기화...
echo ==========================
git pull --rebase origin main

REM 4. 모든 변경 파일 추가
echo ==========================
echo 변경된 파일 스테이징 중...
echo ==========================
git add -A

REM 5. 커밋 (현재 날짜/시간 포함)
set commitmsg=Auto update on %date% %time%
echo ==========================
echo 커밋 메시지: %commitmsg%
echo ==========================
git commit -m "%commitmsg%"

REM 6. 원격 푸시
echo ==========================
echo 원격(main)으로 푸시...
echo ==========================
git push origin main

REM 7. 완료 안내
echo ==========================
echo Git Push 완료! Vercel이 자동 배포를 시작합니다.
echo ==========================
pause
