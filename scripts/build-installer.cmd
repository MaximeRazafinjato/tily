@echo off
setlocal
cd /d "%~dp0.."

set CHANNEL=stable
set INSTALLER=Tily
set APPNAME=Tily
if /i "%~1"=="beta" (
  if "%~2"=="" (
    echo Usage : scripts\build-installer.cmd beta ^<version^>, par exemple 2.3.0-beta.1
    exit /b 1
  )
  set CHANNEL=beta
  set INSTALLER=TilyBeta
  set APPNAME=Tily Beta
  set VERSION=%~2
) else (
  for /f "delims=" %%v in ('dotnet msbuild src\Tily.Host\Tily.Host.csproj -getProperty:Version -nologo') do set VERSION=%%v
)
if "%VERSION%"=="" (
  echo Version introuvable dans src\Tily.Host\Tily.Host.csproj
  exit /b 1
)
echo %APPNAME% %VERSION%

echo [1/4] Nettoyage de la publication precedente
if exist publish rmdir /s /q publish

echo [2/4] Publication autonome win-x64 (Windows App SDK et interface web embarques)
dotnet publish src\Tily.Host\Tily.Host.csproj -c Release -r win-x64 -p:Platform=x64 -p:Channel=%CHANNEL% -p:Version=%VERSION% --self-contained -o publish || exit /b 1

echo [3/4] Programme d'installation WebView2 Evergreen
if not exist installer\MicrosoftEdgeWebview2Setup.exe (
  curl -L -o installer\MicrosoftEdgeWebview2Setup.exe "https://go.microsoft.com/fwlink/p/?LinkId=2124703" || exit /b 1
)

echo [4/4] Compilation de l'installeur Inno Setup
set ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe
if not exist "%ISCC%" set ISCC=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe
if not exist "%ISCC%" (
  echo Inno Setup 6 introuvable : installez-le depuis https://jrsoftware.org/isdl.php
  exit /b 1
)
"%ISCC%" /Qp /DAppVersion=%VERSION% /DChannel=%CHANNEL% installer\Tily.iss || exit /b 1
echo Installeur produit : installer\output\%INSTALLER%-%VERSION%-setup.exe
