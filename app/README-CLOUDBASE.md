# 共见塔罗 · CloudBase 部署

目标环境：`gongjian-tarot-d2geleaahb9b8605e`（上海）。前端是纯静态 Vite 应用，数据通过 CloudBase JS SDK 写入 PostgreSQL。匿名用户登录后拥有稳定的 `auth.uid()`；RLS 允许所有群成员读取全部记录，只允许创建者补充反馈或删除自己的记录。

## 本地验证

```powershell
npm ci
npm test
npm run build
npx tsc --noEmit
```

## 数据库迁移

```powershell
tcb db pg migration up -e gongjian-tarot-d2geleaahb9b8605e --dry-run
tcb db pg migration up -e gongjian-tarot-d2geleaahb9b8605e
tcb db pg migration list -e gongjian-tarot-d2geleaahb9b8605e
```

## 匿名昵称登录

```powershell
tcb env login set -e gongjian-tarot-d2geleaahb9b8605e --anonymous-login true --json
tcb env login get -e gongjian-tarot-d2geleaahb9b8605e --json
```

首次打开时 `getSession()` 可能返回 `credentials not found`，这表示浏览器尚无会话；客户端会继续执行 `signInAnonymously()`，不应把它作为致命错误。

## 静态网站发布

```powershell
npm run build
tcb hosting deploy ./dist / -e gongjian-tarot-d2geleaahb9b8605e
```

线上地址：<https://gongjian-tarot-d2geleaahb9b8605e-1484522062.tcloudbaseapp.com>

> 当前 CloudBase CLI 的 `--verify --safe` 会在该环境的文件列表尚未完成同步时误判缺失并自动回滚，因此本项目使用普通发布，再通过 `hosting list` 和 HTTP 200 独立核验。

## 远端只读验证

```powershell
tcb db execute -e gongjian-tarot-d2geleaahb9b8605e --sql "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='readings'" --json
tcb hosting list / -e gongjian-tarot-d2geleaahb9b8605e --json
```

分享给微信群时使用 CloudBase 静态托管控制台显示的默认域名。体验版不支持备案；如后续绑定自有境内域名，需要升级到支持备案的套餐。
