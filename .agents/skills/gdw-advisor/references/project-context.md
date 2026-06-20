# GDW Project Context

## Product

- 项目名：刚打完（GDW）
- 当前版本：v1.2.0
- 当前阶段：V1.2 产品转向落地
- 技术栈：微信小程序原生 + 微信云开发 + BLE（WIT Motion）
- 当前策略：验证用户是否愿意记录、查看、分享并持续使用网球生活作品
- 当前三 Tab：首页 / 开打 / 我的

## Source Rules

- 飞书维护完整 PRD、阶段摘要、产品决策。
- 网球 APP 仓库保留 AI 可读的决策摘要、实现计划和生成摘要。
- 当前代码、页面、数据模型、自动化脚本，以网球 APP 仓库为准。
- 飞书与仓库冲突时，必须明确指出冲突并请求确认。

## Current Product Definitions

- `Session`：一次完整打球活动，由用户手动开始和结束。
- `Rally`：Session 内一段连续击球；连续两次击球间隔超过 8 秒即开启新 Rally。
- `Hit`：一次击球。
- 0 击球记录不保存为 Session。

## Metrics

- Session 入库成功率
- 作品曝光率
- 详情查看率
- Session 分享率
- 用户分享率
- 7 日 / 30 日留存
- 邀请转化率

## Advisor Repository Boundary

This repository is independent. It should not directly modify the mini-program repository unless the user explicitly asks for a task that targets that repository.
