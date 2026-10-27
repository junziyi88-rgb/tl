# tl 项目换机恢复说明

本说明适用于桌面上的 `tl-complete-backup-*.zip` 完整备份包。备份包包含项目文件、隐藏文件、Git 历史、Git 工作树，以及打包时尚未纳入 Git 的文件。

## 1. 在新设备上准备 Codex

1. 安装 ChatGPT 桌面应用并登录原来的 ChatGPT 账号。
2. 打开应用中的 Codex。
3. 如果需要在终端检查 Git，请确保新设备已安装 Git。

## 2. 解压备份

1. 把 `tl-complete-backup-*.zip` 复制到新设备。
2. 右键压缩包并选择“全部解压”。
3. 建议解压到一个路径较短、你长期不会移动的位置，例如：

   `C:\Projects\tl`

   压缩包本身带有顶层 `tl` 文件夹；选择解压目录时请留意，避免最终得到不必要的 `tl\tl` 两层目录。

4. 不要只复制 `docs` 等可见目录；`.git`、`.worktrees` 等隐藏目录也是恢复项目和版本历史所必需的。

## 3. 在 Codex 中重新打开项目

1. 在 Codex 中选择“打开项目”或添加本地项目。
2. 选择解压后的 `tl` 根目录，也就是包含 `.git` 和本说明文件的目录。
3. 新建任务时确认工作目录显示为这个 `tl` 目录。

## 4. 检查 Git 历史

在 PowerShell 中进入解压后的 `tl` 目录，然后执行：

```powershell
git status
git log --oneline -5
git worktree list
```

能看到分支、最近提交和工作树列表，说明 Git 历史已经恢复。

## 5. 修复换机后的工作树路径

Git 工作树可能记录旧设备上的绝对路径。如果 Codex 或 Git 提示某个 `.worktrees` 工作树路径无效，请在项目根目录执行：

```powershell
$worktreePaths = Get-ChildItem -LiteralPath '.worktrees' -Directory | Select-Object -ExpandProperty FullName
git worktree repair --relative-paths $worktreePaths
git worktree list
```

执行后重新打开 Codex 项目。`--relative-paths` 会让这些工作树以后整体移动时更容易恢复。

## 6. 验证备份文件

解压前可在 PowerShell 中检查压缩包的 SHA-256：

```powershell
Get-FileHash -Algorithm SHA256 '.\tl-complete-backup-文件名.zip'
```

将结果与桌面上的同名 `.sha256.txt` 文件比较。两边哈希值一致，说明压缩包在复制过程中没有损坏。

## 注意事项

- 此压缩包是一次性快照，不会自动同步之后的修改；项目继续变化后需要重新打包。
- 恢复项目文件不等于恢复新设备上的软件、登录状态、系统环境变量或本机密钥；这些需要单独安装或登录。
- 不建议把包含账号缓存或密钥的完整备份包公开分享。
