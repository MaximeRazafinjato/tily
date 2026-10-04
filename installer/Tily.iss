#ifndef AppVersion
  #define AppVersion "2.1.0"
#endif
#define AppName "Tily"
#define AppPublisher "Maxime Razafinjato"
#define AppExe "Tily.exe"
#define SourceDir "..\publish"
#define WebView2Key "\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

[Setup]
AppId={{16F57C9A-8C6B-4E4B-8EA7-714760447F62}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://github.com/MaximeRazafinjato/tily
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
OutputDir=output
OutputBaseFilename=Tily-{#AppVersion}-setup
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline dialog
CloseApplications=yes
RestartApplications=no
WizardStyle=modern

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "Créer un raccourci sur le Bureau"; GroupDescription: "Raccourcis :"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: not IsWebView2Installed

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Classes\AppUserModelId\MaximeRazafinjato.Tily"; Flags: uninsdeletekey dontcreatekey

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Installation du runtime WebView2 Evergreen…"; Check: not IsWebView2Installed; Flags: waituntilterminated
Filename: "{win}\explorer.exe"; Parameters: """{app}\{#AppExe}"""; Flags: nowait runasoriginaluser; Check: ShouldRelaunch

[UninstallRun]
Filename: "{app}\{#AppExe}"; Parameters: "--remove-claude-hooks"; RunOnceId: "RemoveClaudeHooks"; Flags: waituntilterminated skipifdoesntexist

[Code]
const
  Synchronize = $00100000;
  TilyExitTimeout = 30000;

function OpenProcess(DesiredAccess: Cardinal; InheritHandle: Boolean; ProcessId: Cardinal): THandle;
  external 'OpenProcess@kernel32.dll stdcall';
function WaitForSingleObject(Handle: THandle; Milliseconds: Cardinal): Cardinal;
  external 'WaitForSingleObject@kernel32.dll stdcall';
function CloseHandle(Handle: THandle): Boolean;
  external 'CloseHandle@kernel32.dll stdcall';

procedure WaitForProcessExit(ProcessId: Integer);
var
  Handle: THandle;
begin
  if ProcessId <= 0 then
    exit;
  Handle := OpenProcess(Synchronize, False, ProcessId);
  if Handle = 0 then
    exit;
  WaitForSingleObject(Handle, TilyExitTimeout);
  CloseHandle(Handle);
end;

procedure WaitForTilyExit;
var
  Remaining: string;
  Separator: Integer;
begin
  Remaining := ExpandConstant('{param:waitpid|}');
  while Remaining <> '' do
  begin
    Separator := Pos(',', Remaining);
    if Separator = 0 then
    begin
      WaitForProcessExit(StrToIntDef(Trim(Remaining), 0));
      Remaining := '';
    end
    else
    begin
      WaitForProcessExit(StrToIntDef(Trim(Copy(Remaining, 1, Separator - 1)), 0));
      Remaining := Copy(Remaining, Separator + 1, Length(Remaining));
    end;
  end;
end;

function InitializeSetup: Boolean;
begin
  WaitForTilyExit;
  Result := True;
end;

function ShouldRelaunch: Boolean;
begin
  Result := ExpandConstant('{param:relaunch|0}') = '1';
end;

function HasWebView2Value(Root: Integer; const SubKey: string): Boolean;
var
  Version: string;
begin
  Result := RegQueryStringValue(Root, SubKey, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0');
end;

function IsWebView2Installed: Boolean;
begin
  Result := HasWebView2Value(HKLM, 'SOFTWARE\WOW6432Node{#WebView2Key}')
    or HasWebView2Value(HKLM, 'SOFTWARE{#WebView2Key}')
    or HasWebView2Value(HKCU, 'Software{#WebView2Key}');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: string;
begin
  if CurUninstallStep <> usPostUninstall then
    exit;
  DataDir := ExpandConstant('{localappdata}\Tily');
  if UninstallSilent or not DirExists(DataDir) then
    exit;
  if MsgBox('Supprimer aussi vos données Tily (session, texte des terminaux, préférences) ?' + #13#10 + DataDir, mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
    DelTree(DataDir, True, True, True);
end;
