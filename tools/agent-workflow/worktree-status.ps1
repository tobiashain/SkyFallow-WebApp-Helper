$ErrorActionPreference = "Stop"

$commonDir = (& git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir).Trim()
$repo = Split-Path -Parent $commonDir

$porcelain = @(& git -C $repo worktree list --porcelain)
$entries = @()
$current = $null

foreach ($line in $porcelain) {
    if ($line -like "worktree *") {
        if ($null -ne $current) {
            $entries += $current
        }
        $current = [ordered]@{ Path = $line.Substring(9); Branch = "detached" }
    } elseif ($line -like "branch refs/heads/*") {
        $current.Branch = $line.Substring(18)
    }
}
if ($null -ne $current) {
    $entries += $current
}

Write-Host "Worktrees:"
foreach ($entry in $entries) {
    $dirty = @(& git -C $entry.Path status --porcelain)
    $ahead = 0
    $behind = 0
    if ($entry.Branch -ne "detached") {
        $counts = (& git -C $repo rev-list --left-right --count "$($entry.Branch)...origin/master").Trim() -split "\s+"
        $ahead = [int]$counts[0]
        $behind = [int]$counts[1]
    }
    Write-Host ("  {0}" -f $entry.Path)
    Write-Host ("    branch={0} dirty={1} ahead={2} behind={3}" -f $entry.Branch, $dirty.Count, $ahead, $behind)
}

Write-Host "Feature branches:"
$branches = @(& git -C $repo for-each-ref --format="%(refname:short)" "refs/heads/feat/*")
Push-Location $repo
try {
    foreach ($branch in $branches) {
        $json = & gh pr list --head $branch --state all --json number,state --limit 1
        $prs = @($json | ConvertFrom-Json)
        if ($prs.Count -eq 0 -or $null -eq $prs[0] -or $null -eq $prs[0].number) {
            Write-Host ("  {0}: no PR" -f $branch)
        } else {
            Write-Host ("  {0}: PR #{1} {2}" -f $branch, $prs[0].number, $prs[0].state)
        }
    }
} finally {
    Pop-Location
}

$localMaster = (& git -C $repo rev-parse --short master).Trim()
$remoteMaster = (& git -C $repo rev-parse --short origin/master).Trim()
$ahead = 0
$behind = 0
if ($localMaster -ne $remoteMaster) {
    $counts = (& git -C $repo rev-list --left-right --count "master...origin/master").Trim() -split "\s+"
    $ahead = [int]$counts[0]
    $behind = [int]$counts[1]
}
Write-Host ("master: {0} origin/master: {1} ahead={2} behind={3}" -f $localMaster, $remoteMaster, $ahead, $behind)
