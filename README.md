# 装备合成原型

原创竖屏自动战斗小游戏。保留“关卡掉装备 → 背包穿戴 → 5 件同品质装备合成 1 件高品质装备 → 强化 → 继续挑战”的核心循环。Cocos Creator 与网页试玩使用同一份 `assets/scripts/core/game-core.ts` 规则。

## 当前可试玩内容

- 10 个逐步开放的主线关卡，每关多波自动战斗，胜利掉落金币、铁矿和装备。
- 6 个装备位、5 档品质、随机基础属性与少量附加词条，背包比较、穿戴和锁定。
- 5 合 1 装备合成；同部位材料保留产物部位，锁定或已穿戴装备不能消耗。
- 装备强化至 +10、战力计算、浏览器本地存档。
- 营地包含体力恢复（每 5 分钟 1 点）、最多 8 小时离线收益、每日委托、三类永久训练。装备词条参与战斗，背包最多 100 件，多余战利品转为铁矿。
- Cocos 装备页可分解未锁定装备；旧版存档升级后保留装备与资源。
- Cocos 挑战逐步播放各波战斗，显示血条、普攻/技能、暴击和恢复；支持两档速度、刷新续播及结算转装备，续播不会重复发奖。
- 三张临时美术资源：主角、怪物和战斗背景。画风后续会整体重做。

## Cocos Creator 3.8.8

用 Creator 打开本目录中的 `assets/Main.scene`，点击顶部预览即可试玩。该场景已挂载 `StarforgeGame`，设计分辨率为 420×840。冒险、装备、合成三页共享 `assets/scripts/core/game-core.ts` 的规则。

要更新 GitHub 网页预览，在 Creator 的“发布到 → 终端 → Web 手机端”中构建，然后于项目根目录运行：

```text
npm test
npm run export:cocos-web
```

构建产物位于 `build/web-mobile`；导出命令将其复制到提交入库的 `docs`。GitHub Actions 执行规则测试后，把 `docs` 发布到 GitHub Pages。`web` 是独立的轻量浏览器调试页，发布版本以 Cocos 构建为准。

首次打开工程后可在 Creator 的“发布到 → 应用 → 微信小游戏”中创建微信构建配置。微信包及微信开发者工具联调尚未完成；网页预览通过后再验证平台接口、包体和触控体验。

## GitHub Pages

仓库：[baileykv75-netizen/merge](https://github.com/baileykv75-netizen/merge)。`.github/workflows/pages.yml` 在推送到 `main` 时执行测试并发布 `docs`。仓库的 Settings → Pages → Build and deployment 应设为 **GitHub Actions**。

## 边界

第一版聚焦战斗与装备闭环。宝石、洗练、重铸、材料副本、竞技场、广告与付费未实现。网页存档和微信小游戏存档各自独立；需要跨端继承时再增加账号及云端存档。

完整游戏开发清单及已验证范围见 [DEVELOPMENT.md](DEVELOPMENT.md)。当前是持续开发版本，尚未完成成熟游戏验收。
