[CmdletBinding()]
param(
  [string]$TaskName = 'GongjianTarot-Supabase-WeeklyBackup',
  [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')]
  [string]$At = '03:00'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backupScript = Join-Path $PSScriptRoot 'backup-supabase.ps1'
$localEnvPath = Join-Path $projectRoot '.env.supabase.local'

if (-not (Test-Path -LiteralPath $localEnvPath)) {
  throw '请先创建 .env.supabase.local 并配置 SUPABASE_DB_URL。'
}
& (Join-Path $PSScriptRoot 'Test-PostgresTools.ps1') | Out-Null

$startAt = [DateTime]::Today.Add([TimeSpan]::Parse($At))
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $startAt
$principal = New-ScheduledTaskPrincipal `
  -UserId "$env:USERDOMAIN\$env:USERNAME" `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Description 'Weekly schema and data backup for Gongjian Tarot Alibaba Supabase.' `
  -Force | Out-Null

Write-Output "Scheduled task '$TaskName' will run every Sunday at $At while this user is signed in."
