# Colors

一款支持鼠标和触屏的 3D 网页益智游戏，共 70 关。

| 章节 | 关卡 | 玩法 |
| --- | --- | --- |
| 连锁升降 | 1–30 | 点击柱子，让它和上下左右的柱子各按箭头升降。同色柱等高时整组消除。 |
| 错层移位 | 31–40 | 把一颗顶层软糖搬到相邻格，改变两格的高度。 |
| 顶层交换 | 41–70 | 互换两根相邻柱子的顶层软糖。同色互换不计步。 |

后两种玩法在同一高度露出至少三颗同色软糖时触发消除。清空棋盘即可过关。首次进入各章会显示玩法教学，选关界面可切换章节。视角可以连续调整，星级进度保存在当前浏览器。

## 本地运行

直接用支持 WebGL 2 的浏览器打开根目录的 `index.html`。页面包含游戏代码及 Three.js，无需下载其他资源。

## 修改与验证

在仓库根目录运行以下命令，需要 Node.js 20 或以上。

```sh
node work/build.mjs
node --test work/levels.test.mjs work/rules.test.mjs
node work/verify-full-boards.mjs
```

游戏逻辑、界面和关卡数据位于 `work/`。Three.js 的许可证见 `vendor/LICENSE-three.txt`。

## GitHub Pages

在仓库 **Settings → Pages** 选择 **Deploy from a branch → main / (root)**。

[观看 26 秒玩法演示](colors-demo.mp4)
