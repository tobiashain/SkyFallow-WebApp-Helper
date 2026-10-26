$ErrorActionPreference = "Stop"

$worktree = $env:WORKTREE_PATH
if (-not $worktree) {
    $worktree = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}

Push-Location $worktree
try {
    & npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm ci failed for $worktree."
        exit $LASTEXITCODE
    }

    & npm run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Lint reported errors. The base already carries lint debt; the build gate continues. Fix lint in the files you touch."
    }

    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed for $worktree."
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

$dirty = @(& git -C $worktree status --porcelain)
if ($dirty.Count -gt 0) {
    Write-Error "Worktree is dirty after build:`n$($dirty -join "`n")"
    exit 1
}

Write-Host "Setup verified: $worktree"
exit 0
