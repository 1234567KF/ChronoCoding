chcp 65001 > $null
$env:PYTHONIOENCODING = "utf-8"
$env:LC_ALL = "C.UTF-8"
cd D:\AICoding
& "C:\Users\Administrator\AppData\Roaming\npm\claude.cmd" --print --permission-mode bypassPermissions "创建一个`省token实测报告.md`，包含：1) 当前系统配置 2) 测试任务（搜索.ts文件统计行数）3) 完成后报告token使用量。保存到 D:\AICoding\token测评\叠加测试_结果.md"