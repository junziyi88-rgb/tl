[CmdletBinding()]
param(
  [string]$DatabaseUrl = $env:SUPABASE_DB_URL,
  [string]$OutputRoot = (Join-Path $PSScriptRoot '..\backups\supabase')
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$localEnvPath = Join-Path $projectRoot '.env.supabase.local'

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

& (Join-Path $PSScriptRoot 'Test-PostgresTools.ps1') | Out-Null
$connection = Get-PostgresConnectionArguments $DatabaseUrl
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmssZ')
$backupDirectory = Join-Path $OutputRoot $timestamp
$schemaFile = Join-Path $backupDirectory 'schema.sql'
$dataFile = Join-Path $backupDirectory 'data.sql'
$checksumFile = Join-Path $backupDirectory 'SHA256SUMS.txt'

New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$oldPgPassword = $env:PGPASSWORD
$env:PGPASSWORD = $connection.Password

try {
  $commonArguments = @(
    "--host=$($connection.Host)",
    "--port=$($connection.Port)",
    "--username=$($connection.User)",
    "--dbname=$($connection.Database)",
    '--schema=public',
    '--no-owner',
    '--no-privileges'
  )

  & pg_dump @commonArguments '--schema-only' "--file=$schemaFile"
  if ($LASTEXITCODE -ne 0) { throw '数据库结构备份失败。' }

  & pg_dump @commonArguments '--data-only' '--inserts' '--column-inserts' "--file=$dataFile"
  if ($LASTEXITCODE -ne 0) { throw '数据库数据备份失败。' }

  $checksums = @($schemaFile, $dataFile) | ForEach-Object {
    $hash = Get-FileHash -LiteralPath $_ -Algorithm SHA256
    "$($hash.Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($_))"
  }
  Set-Content -LiteralPath $checksumFile -Value $checksums -Encoding utf8
} finally {
  $env:PGPASSWORD = $oldPgPassword
}

Write-Output $backupDirectory
