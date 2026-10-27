# 共见塔罗 · 腾讯前端、阿里 Supabase 数据库与浏览器直连 DeepSeek

腾讯云环境 `gongjian-tarot-d2geleaahb9b8605e` 只托管静态 Vite 前端。数据库部署在阿里云杭州的 AnalyticDB PostgreSQL 版 Supabase 免费项目。DeepSeek 由浏览器直接请求，不使用 uniCloud、Supabase Edge Function、EIP 或 NAT。

生产链路：

```text
腾讯云静态前端 ──> 阿里云 Supabase PostgREST ──> PostgreSQL
              └──> DeepSeek 公网 API
```

浏览器不再请求 Neon、ChatGPT 域名或任何 AI 中转云函数。`VITE_DEEPSEEK_API_KEY` 会被打包到公开 JavaScript 中；这是项目所有者针对小额可损耗密钥做出的明确选择。不得放入高余额或有其他权限的密钥。

## 1. 创建阿里云免费项目

进入阿里云控制台：

`云原生数据仓库 AnalyticDB PostgreSQL版 -> Supabase -> 创建项目 -> 免费测试创建`

选择华东1（杭州）和免费版 `1C2G / 1GB`。不要创建需要付费 RDS 实例的 RDS Supabase。

项目创建完成后记录以下三项：

- Project URL；
- anon key 或 publishable key；
- PostgreSQL connection string。

数据库连接串是密钥，不得放进浏览器代码、Git 或聊天消息。

## 2. 配置本地环境

复制示例文件：

```powershell
Copy-Item .env.supabase.example .env.supabase.local
```

填写：

```dotenv
VITE_SUPABASE_URL=https://项目接口地址
VITE_SUPABASE_ANON_KEY=浏览器可公开的匿名密钥
VITE_DEEPSEEK_API_KEY=sk-仅保留小额余额的可公开密钥
SUPABASE_DB_URL=postgresql://数据库用户:密码@数据库地址:5432/postgres?sslmode=require
```

`npm run build:supabase` 使用 `.env.supabase.local` 构建。Vite 只会把 `VITE_` 开头的三个公开值放入前端；`SUPABASE_DB_URL` 不会进入浏览器包。

## 3. 初始化数据库

在 Supabase Dashboard 的 SQL Editor 中执行：

[`supabase/migrations/20260921000000_tarot.sql`](supabase/migrations/20260921000000_tarot.sql)

迁移会创建：

- `readings`、`custom_spreads`；
- 公开但不含身份令牌的 `reading_feed`；
- 基于 `x-owner-id`、`x-owner-token` 请求头的 RLS 写入保护；
- 表级与列级最小权限授权，不使用阿里云禁用的 `SECURITY DEFINER` RPC。

迁移脚本必须保留在 Git 中。新项目或灾难恢复时重新执行同一个文件。

## 4. 构建和发布腾讯静态前端

```powershell
npm ci
npm test
npx tsc --noEmit
npm run build:supabase
tcb hosting deploy ./dist / -e gongjian-tarot-d2geleaahb9b8605e
```

线上地址：<https://gongjian-tarot-d2geleaahb9b8605e-1484522062.tcloudbaseapp.com>

## 5. 数据库备份

备份依赖 PostgreSQL 客户端中的 `pg_dump` 和 `psql`：

```powershell
npm run db:check-tools
npm run db:backup
```

每次备份生成：

```text
backups/supabase/YYYYMMDD-HHmmssZ/
  schema.sql
  data.sql
  SHA256SUMS.txt
```

备份目录和 `.env.supabase.local` 已加入 `.gitignore`。迁移脚本保留在 Git，数据库实际数据保留在本地备份中。

### 每周自动备份

下面的命令注册一个 Windows 计划任务，每周日凌晨 03:00 在当前用户已登录时执行：

```powershell
npm run db:schedule-backup
```

自定义时间：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Register-WeeklyBackupTask.ps1 -At 02:30
```

## 6. 恢复演练

恢复会写入目标数据库，因此必须显式添加 `-ConfirmRestore`：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-supabase.ps1 `
  -BackupDirectory .\backups\supabase\YYYYMMDD-HHmmssZ `
  -ConfirmRestore
```

如果目标项目已经执行过迁移、只需要恢复业务数据：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-supabase.ps1 `
  -BackupDirectory .\backups\supabase\YYYYMMDD-HHmmssZ `
  -DataOnly `
  -ConfirmRestore
```

建议每月至少做一次恢复演练。只有能成功恢复的备份才算有效备份。
