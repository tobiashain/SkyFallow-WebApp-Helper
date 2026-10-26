[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Feature,
    [switch]$Abandon,
    [switch]$Force
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

& git -C $repo fetch origin --prune
if ($LASTEXITCODE -ne 0) {
    throw "Could not fetch from origin."
}

$hasWorktree = Test-Path -LiteralPath $worktree
$hasBranch = $false
& git -C $repo show-ref --verify --quiet "refs/heads/$branch"
if ($LASTEXITCODE -eq 0) {
    $hasBranch = $true
}

if (-not $hasWorktree -and -not $hasBranch) {
    throw "Nothing to remove for '$Feature'."
}

if (-not $Abandon) {
    Push-Location $repo
    try {
        $json = & gh pr list --head $branch --state all --json number,state --limit 1
        $ghOk = $LASTEXITCODE -eq 0
    } finally {
        Pop-Location
    }
    if (-not $ghOk) {
        throw "Could not query pull requests with gh."
    }
    $prs = @($json | ConvertFrom-Json)
    if ($prs.Count -eq 0 -or $null -eq $prs[0]) {
        throw "No pull request found for $branch. Use -Abandon to discard unmerged work."
    }
    if ($prs[0].state -ne "MERGED") {
        throw "Pull request #$($prs[0].number) for $branch is $($prs[0].state), not MERGED."
    }
    $proof = "merged PR #$($prs[0].number)"
} else {
    $proof = "abandoned"
    if (-not $Force) {
        $problems = @()
        if ($hasWorktree) {
            $dirty = @(& git -C $worktree status --porcelain)
            if ($dirty.Count -gt 0) {
                $problems += "Uncommitted changes:`n$($dirty -join "`n")"
            }
        }
        if ($hasBranch) {
            $unique = @(& git -C $repo log --oneline origin/master..$branch)
            if ($unique.Count -gt 0) {
                $problems += "Unpushed commits:`n$($unique -join "`n")"
            }
        }
        if ($problems.Count -gt 0) {
            throw "Refusing to abandon work without -Force.`n$($problems -join "`n")"
        }
    }
}

$localMaster = (& git -C $repo rev-parse master).Trim()
$remoteMaster = (& git -C $repo rev-parse origin/master).Trim()

if ($localMaster -ne $remoteMaster) {
    & git -C $repo merge-base --is-ancestor master origin/master
    if ($LASTEXITCODE -ne 0) {
        throw "Local master is ahead of or diverged from origin/master. Reconcile it before cleaning up."
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
        $masterDirty = @(& git -C $masterWorktree status --porcelain)
        if ($masterDirty.Count -gt 0) {
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

if ($hasWorktree) {
    & git -C $repo worktree remove $worktree
    if ($LASTEXITCODE -ne 0) {
        if ($Force) {
            & git -C $repo worktree remove --force $worktree
            if ($LASTEXITCODE -ne 0) {
                throw "Could not remove worktree $worktree."
            }
        } else {
            throw "Could not remove worktree $worktree. Use -Force to discard scratch files."
        }
    }
}

if ($hasBranch) {
    & git -C $repo branch -D $branch
    if ($LASTEXITCODE -ne 0) {
        throw "Could not delete local branch $branch."
    }
}

$remoteBranch = @(& git -C $repo ls-remote --heads origin $branch)
if ($remoteBranch.Count -gt 0) {
    & git -C $repo push origin --delete $branch
    if ($LASTEXITCODE -ne 0) {
        throw "Could not delete remote branch $branch."
    }
}

Write-Host "Removed $Feature ($proof)."
