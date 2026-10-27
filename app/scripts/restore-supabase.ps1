[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDirectory,
  [string]$DatabaseUrl = $env:SUPABASE_DB_URL,
  [switch]$DataOnly,
  [switch]$ConfirmRestore
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$localEnvPath = Join-Path $projectRoot '.env.supabase.local'
$schemaFile = Join-Path $BackupDirectory 'schema.sql'
$dataFile = Join-Path $BackupDirectory 'data.sql'
$checksumFile = Join-Path $BackupDirectory 'SHA256SUMS.txt'

if (-not $ConfirmRestore) {
  throw '恢复会写入目标数据库。确认目标无误后重新执行并添加 -ConfirmRestore。'
}

function Read-LocalDatabaseUrl {
  if (-not (Test-Path -LiteralPath $localEnvPath)) { return $null }
  $line = Get-Content -LiteralPath $localEnvPath |
    Where-Object { $_ -match '^\s*SUPABASE_DB_URL\s*=' } |
    Select-Object -First 1
  if (-not $line) { return $null }
  $value = ($line -replace '^\s*SUPABASE_DB_URL\s*=\s*', '').Trim()
  return $value.Trim('"').Trim("'")
}

function Get-PostgresConnectionArguments([string]$ConnectionUrl) {
  $uri = [Uri]$ConnectionUrl
  $credentials = $uri.UserInfo.Split(':', 2)
  if ($credentials.Count -ne 2) {
    throw 'SUPABASE_DB_URL 必须包含数据库用户名和密码。'
  }
  return @{
    Host = $uri.Host
    Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
    User = [Uri]::UnescapeDataString($credentials[0])
    Password = [Uri]::UnescapeDataString($credentials[1])
    Database = $uri.AbsolutePath.TrimStart('/')
  }
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $DatabaseUrl = Read-LocalDatabaseUrl
}
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw '请设置 SUPABASE_DB_URL，或在 .env.supabase.local 中填写该变量。'
}
if (-not (Test-Path -LiteralPath $dataFile)) {
  throw "备份中缺少数据文件：$dataFile"
}
if (-not $DataOnly -and -not (Test-Path -LiteralPath $schemaFile)) {
  throw "备份中缺少结构文件：$schemaFile"
}

if (Test-Path -LiteralPath $checksumFile) {
  foreach ($line in Get-Content -LiteralPath $checksumFile) {
    if ($line -notmatch '^([0-9a-f]{64})\s+(.+)$') { continue }
    $expected = $Matches[1]
    $file = Join-Path $BackupDirectory $Matches[2]
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "备份校验失败：$file" }
  }
}

& (Join-Path $PSScriptRoot 'Test-PostgresTools.ps1') | Out-Null
$connection = Get-PostgresConnectionArguments $DatabaseUrl
$psqlArguments = @(
  "--host=$($connection.Host)",
  "--port=$($connection.Port)",
  "--username=$($connection.User)",
  "--dbname=$($connection.Database)",
  '--set=ON_ERROR_STOP=1'
)
$oldPgPassword = $env:PGPASSWORD
$env:PGPASSWORD = $connection.Password

try {
  if (-not $DataOnly) {
    & psql @psqlArguments "--file=$schemaFile"
    if ($LASTEXITCODE -ne 0) { throw '数据库结构恢复失败。' }
  }

  & psql @psqlArguments "--file=$dataFile"
  if ($LASTEXITCODE -ne 0) { throw '数据库数据恢复失败。' }
} finally {
  $env:PGPASSWORD = $oldPgPassword
}

Write-Output 'Supabase database restore completed.'
