[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$missing = @()
$pgDump = Get-Command -Name 'pg_dump' -ErrorAction SilentlyContinue
$psql = Get-Command -Name 'psql' -ErrorAction SilentlyContinue
if (-not $pgDump) { $missing += 'pg_dump' }
if (-not $psql) { $missing += 'psql' }

if ($missing.Count -gt 0) {
  throw "缺少 PostgreSQL 客户端工具：$($missing -join ', ')。请安装 PostgreSQL client，并确认其 bin 目录已加入 PATH。"
}

Write-Output 'PostgreSQL backup tools are available.'
