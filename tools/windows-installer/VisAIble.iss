#define MyAppName "VisAIble"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "VisAIble"

[Setup]
AppId={{A8219A75-36EF-46CB-A9CE-CB8AC2B0C9D5}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\VisAIble
DefaultGroupName=VisAIble
OutputDir=output
OutputBaseFilename=VisAIble_Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\scripts\windows\launch.ps1

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\..\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "__pycache__\*,*.pyc,data\*,.env.local"
Source: "..\..\frontend\*"; DestDir: "{app}\frontend"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,.next\*,.next-dev\*,.next-build\*,.next_stale_*\*,dist\*,out\*,.vercel\*,.env.local,tsconfig.tsbuildinfo"
Source: "..\..\scripts\windows\*"; DestDir: "{app}\scripts\windows"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\VisAIble"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\windows\launch.ps1"""; WorkingDir: "{app}"
Name: "{autodesktop}\VisAIble"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\windows\launch.ps1"""; WorkingDir: "{app}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\windows\launch.ps1"""; WorkingDir: "{app}"; Description: "Launch VisAIble"; Flags: postinstall nowait skipifsilent unchecked
