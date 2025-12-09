@echo off
setlocal

echo ==============================================
echo [Cross Manager] Batch Build & Deployment Setup
echo ==============================================

set ROOT_DIR=%~dp0
set DIST_ALL=%ROOT_DIR%dist_all

echo [1/6] Cleaning dist_all directory...
if exist "%DIST_ALL%" rmdir /s /q "%DIST_ALL%"
mkdir "%DIST_ALL%"
mkdir "%DIST_ALL%\pms"
mkdir "%DIST_ALL%\ems"
mkdir "%DIST_ALL%\swms"
mkdir "%DIST_ALL%\sms"
mkdir "%DIST_ALL%\images"

echo Copying shared assets...
xcopy /s /e /y "%ROOT_DIR%Public\images\*" "%DIST_ALL%\images\"

echo [2/6] Building Portal (Root)...
cd "%ROOT_DIR%Portal"
call npm install
call npm run build
if errorlevel 1 goto :error
echo Copying Portal build to dist_all...
xcopy /s /e /y "%ROOT_DIR%Portal\dist\*" "%DIST_ALL%\"

echo [3/6] Building PMS...
cd "%ROOT_DIR%PMS"
call npm install
call npm run build
if errorlevel 1 goto :error
echo Copying PMS build to dist_all/pms...
xcopy /s /e /y "%ROOT_DIR%PMS\dist\*" "%DIST_ALL%\pms\"

echo [4/6] Building EMS...
cd "%ROOT_DIR%EMS"
call npm install
call npm run build
if errorlevel 1 goto :error
echo Copying EMS build to dist_all/ems...
xcopy /s /e /y "%ROOT_DIR%EMS\dist\*" "%DIST_ALL%\ems\"

echo [5/6] Building SWMS...
cd "%ROOT_DIR%SWMS"
call npm install
call npm run build
if errorlevel 1 goto :error
echo Copying SWMS build to dist_all/swms...
xcopy /s /e /y "%ROOT_DIR%SWMS\dist\*" "%DIST_ALL%\swms\"

echo [6/6] Building SMS...
cd "%ROOT_DIR%SMS"
call npm install
call npm run build
if errorlevel 1 goto :error
echo Copying SMS build to dist_all/sms...
xcopy /s /e /y "%ROOT_DIR%SMS\dist\*" "%DIST_ALL%\sms\"

echo.
echo ==============================================
echo [Success] All modules built and aggregated in dist_all
echo Ready for 'firebase deploy'
echo ==============================================
exit /b 0

:error
echo.
echo [Error] Build failed. Check logs above.
exit /b 1
