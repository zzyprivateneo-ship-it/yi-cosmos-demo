# 易·宇宙｜周易可视化 Demo

“易·宇宙”是一个以《周易》文本、卦象关系与易学人物为核心的浏览器端可视化项目。当前仓库保存可直接部署的静态 Demo，包含问卦、六十四卦多面星图和周易生命史三个主要模块。

## 在线访问

- [项目首页](https://zzyprivateneo-ship-it.github.io/yi-cosmos-demo/)
- [问卦](https://zzyprivateneo-ship-it.github.io/yi-cosmos-demo/divination/)
- [六十四卦多面星图](https://zzyprivateneo-ship-it.github.io/yi-cosmos-demo/star-map/)
- [周易生命史](https://zzyprivateneo-ship-it.github.io/yi-cosmos-demo/life-history/)

## 功能概览

### 问卦

通过“问、筮、得”三个阶段完成一次六爻问卦：

- 支持填写或略过所问之事；
- 以三枚铜钱、自下而上的方式生成六爻；
- 展示本卦、变爻、之卦、经文依据和相关注家材料；
- 可从结果继续前往星图或生命史页面。

问题文本仅在当前浏览器页面中用于生成阅读结果，不会由本项目上传到服务器。

### 六十四卦多面星图

以 Three.js 构建六十四卦三维星图：

- 浏览、旋转和缩放六十四卦星体；
- 按卦序、注家和错综关系切换星线；
- 搜索卦名、卦辞或注家；
- 点击星体查看卦辞、爻辞、今译和注文；
- 在卦象详览中逐爻阅读相关材料。

### 周易生命史

以时间与知识关系组织易学人物、著作、概念和事件：

- 浏览易学人物及其时代位置；
- 查看人物、著作与思想关系；
- 使用时间轴观察易学传统的历史演变；
- 在生命史与星图之间访问相关注家内容。

## 技术说明

- 静态多页面应用，不需要后端服务；
- 使用原生 HTML、CSS 和 JavaScript；
- 三维星图基于 Three.js `0.179.1`；
- 主要文本和关系数据随站点静态发布；
- GitHub Pages 从 `main` 分支根目录部署。

## 本地预览

浏览器的模块与数据加载需要 HTTP 环境，不建议直接双击 `index.html`。克隆仓库后，可在仓库根目录运行任意静态文件服务器，例如：

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

本仓库已经包含 Demo 运行所需的 Three.js 文件，无需执行 `npm install`。

## 目录结构

```text
.
├─ index.html              # 项目首页
├─ divination/             # 问卦页面
├─ star-map/               # 星图入口
├─ life-history/           # 周易生命史页面与数据
├─ data/                   # 卦象、今译、语义布局与注文数据
├─ node_modules/three/     # Demo 使用的 Three.js 运行文件
├─ app.js                  # 星图主程序
├─ styles.css              # 星图样式
├─ shared-shell.js         # 公共页面外壳
└─ shared-shell.css        # 公共导航与视觉样式
```

## 使用提示

- 建议使用最新版 Chrome、Edge、Firefox 或 Safari；
- 星图需要浏览器支持 WebGL；
- 桌面端能获得更完整的三维交互和详览体验；
- 如果启用了“减少动态效果”，部分动画会自动简化；
- 页面内容用于文化研究、文本浏览与可视化展示，不构成现实决策建议。

## 数据与授权说明

项目包含《周易》相关经典文本、今译、历代注文整理数据及生命史关系数据。公开访问不等于自动授予复制、再发布或商业使用许可；项目内容的具体授权范围以仓库后续正式发布的许可证与说明为准。

Three.js 的授权信息见：

```text
node_modules/three/LICENSE
```

## 当前版本

这是用于展示和审阅的静态 Demo。仓库不包含 Trae 工作记录、阶段备份、测试材料和本机工程文件。
