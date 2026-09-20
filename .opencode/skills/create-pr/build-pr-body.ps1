<#
.SYNOPSIS
  Builds a PR body from .github/PULL_REQUEST_TEMPLATE.md, filling every
  {{PLACEHOLDER}} and ticking the checklist boxes the create-pr workflow
  verified.

.DESCRIPTION
  Companion tool for the create-pr skill. Writes the filled body to a temp file
  (or -OutputPath) and prints that path, so it can be passed straight to
  `gh pr create --body-file`.

  Lint/Test/Build are always ticked: the skill only reaches this step after
  `npm run lint`, `npm test` and `npm run build` all pass. Docs/Features are
  switches because they depend on the change.

.PARAMETER Summary
  The PR summary (the {{SUMMARY}} placeholder). Use a here-string for bullets.

.PARAMETER IssueNumber
  The linked issue number, digits only (no '#').

.PARAMETER Testing
  The commands run and their results (the {{TESTING}} placeholder).

.PARAMETER ClosingKeyword
  'Closes' (feature) or 'Fixes' (bug). Defaults to 'Closes'.

.PARAMETER Docs
  Pass to tick "Documentation updated".

.PARAMETER Features
  Pass to tick "docs/Features.md synced".

.PARAMETER OutputPath
  Where to write the body. Defaults to a temp file.

.PARAMETER TemplatePath
  The PR template to fill. Defaults to the repo's
  .github/PULL_REQUEST_TEMPLATE.md (resolved from this script's location).

.EXAMPLE
  $tmp = & "<this-skill-directory>\build-pr-body.ps1" `
    -Summary $summary -IssueNumber 45 -Testing $testing -Docs -Features
  & "C:\Program Files\GitHub CLI\gh.exe" pr create --base main `
    --title "O-012: Platformer Bombs" --body-file $tmp
#>
param(
  [Parameter(Mandatory = $true)][string]$Summary,
  [Parameter(Mandatory = $true)][int]$IssueNumber,
  [Parameter(Mandatory = $true)][string]$Testing,
  [ValidateSet('Closes', 'Fixes')][string]$ClosingKeyword = 'Closes',
  [switch]$Docs,
  [switch]$Features,
  [string]$OutputPath = (Join-Path $env:TEMP 'pr-body.md'),
  [string]$TemplatePath
)

if (-not $TemplatePath) {
  # This script lives at <repo>/.opencode/skills/create-pr/, so the repo root is
  # three levels up.
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
  $TemplatePath = Join-Path $repoRoot '.github\PULL_REQUEST_TEMPLATE.md'
}

$docsTick = if ($Docs) { 'x' } else { ' ' }
$featuresTick = if ($Features) { 'x' } else { ' ' }

$body = Get-Content -LiteralPath $TemplatePath -Raw
$body = $body.Replace('{{SUMMARY}}', $Summary.TrimEnd())
$body = $body.Replace('{{CLOSING_KEYWORD}}', $ClosingKeyword)
$body = $body.Replace('{{ISSUE_NUMBER}}', "$IssueNumber")
$body = $body.Replace('{{TESTING}}', $Testing.TrimEnd())
$body = $body.Replace('{{LINT}}', 'x')
$body = $body.Replace('{{TEST}}', 'x')
$body = $body.Replace('{{BUILD}}', 'x')
$body = $body.Replace('{{DOCS}}', $docsTick)
$body = $body.Replace('{{FEATURES}}', $featuresTick)

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}
[System.IO.File]::WriteAllText($OutputPath, $body, (New-Object System.Text.UTF8Encoding($false)))

Write-Output $OutputPath
