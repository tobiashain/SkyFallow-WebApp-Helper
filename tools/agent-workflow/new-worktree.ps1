[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Feature
)

$ErrorActionPreference = "Stop"

$commonDir = (& git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir).Trim()
$repo = Split-Path -Parent $commonDir
$worktreesRoot = Join-Path (Split-Path -Parent $repo) "worktrees"
$worktree = Join-Path (Join-Path $worktreesRoot (Split-Path -Leaf $repo)) $Feature
$branch = "feat/$Feature"

if ($Feature -notmatch '^[a-z0-9][a-z0-9-]*$') {
    throw "Feature name '$Feature' must be lowercase letters, digits, or hyphens."
}

if (Test-Path -LiteralPath $worktree) {
    throw "Worktree already exists: $worktree"
}

& git -C $repo show-ref --verify --quiet "refs/heads/$branch"
if ($LASTEXITCODE -eq 0) {
    throw "Branch already exists: $branch"
}

& git -C $repo fetch origin --prune
if ($LASTEXITCODE -ne 0) {
    throw "Could not fetch from origin."
}

$localMaster = (& git -C $repo rev-parse master).Trim()
$remoteMaster = (& git -C $repo rev-parse origin/master).Trim()

if ($localMaster -ne $remoteMaster) {
    & git -C $repo merge-base --is-ancestor master origin/master
    if ($LASTEXITCODE -ne 0) {
        throw "Local master is ahead of or diverged from origin/master. Reconcile it before creating a worktree."
    }

    $porcelain = @(& git -C $repo worktree list --porcelain)
    $masterWorktree = $null
    $current = $null
    foreach ($line in $porcelain) {
        if ($line -like "worktree *") {
            $current = $line.Substring(9)
        } elseif ($line -eq "branch refs/heads/master") {
            $masterWorktree = $current
        }
    }

    if ($masterWorktree) {
        $dirty = @(& git -C $masterWorktree status --porcelain)
        if ($dirty.Count -gt 0) {
            throw "The master checkout is dirty: $masterWorktree. Commit or discard its changes first."
        }
        & git -C $masterWorktree merge --ff-only origin/master
        if ($LASTEXITCODE -ne 0) {
            throw "Could not fast-forward master in $masterWorktree."
        }
    } else {
        & git -C $repo fetch origin master:master
        if ($LASTEXITCODE -ne 0) {
            throw "Could not fast-forward local master."
        }
    }
}

New-Item -ItemType Directory -Path (Split-Path -Parent $worktree) -Force | Out-Null

& git -C $repo worktree add $worktree -b $branch origin/master
if ($LASTEXITCODE -ne 0) {
    throw "Could not create worktree $worktree."
}

$env:WORKTREE_PATH = $worktree
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $worktree ".kilo/setup-script.ps1")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Setup failed. The worktree was left at $worktree for inspection."
    exit $LASTEXITCODE
}

Write-Host "Worktree ready: $worktree"
Write-Host "Branch: $branch (based on origin/master)"
