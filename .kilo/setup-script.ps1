$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "tools/agent-workflow/setup.ps1")
exit $LASTEXITCODE
