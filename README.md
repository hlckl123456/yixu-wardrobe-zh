# 衣序 · 中文版

一个在自己电脑上运行的衣橱网站。把衣物整理成档案，保存愿意照着穿的搭配，再看看哪些衣服一直没有用到。

**[English version → yixu-wardrobe-en](https://github.com/hlckl123456/yixu-wardrobe-en)**

## 能做什么

- 浏览衣物，按类别和搭配使用次数筛选。
- 保存搭配及穿法说明，从一件衣服查看用到它的搭配。
- 把暂时不想穿的衣服移到「准备丢弃」，保留档案，之后也能恢复。
- 用 SQLite 保存衣物、搭配和它们的关联。图片在本地保存，并校验文件完整性。

网站负责浏览。照片预处理、搭配生成和资料录入，需要你在外部聊天或 AI 工具中完成，再通过本项目的命令行工具维护。当前版本没有网页上传按钮，也不内置模型调用、自动抠图或一键生成搭配。

## 启动

需要 Node.js 24 或更新版本。不需要安装运行时 npm 依赖。

```sh
git clone https://github.com/hlckl123456/yixu-wardrobe-zh.git
cd yixu-wardrobe-zh
npm start
```

打开 http://127.0.0.1:4183/#outfits 。首次启动是空衣橱。

```sh
npm run status
npm stop
```

macOS 也可以双击 `启动衣橱.command` 和 `停止衣橱.command`。如果启动器找不到 Node，可用 `YIXU_NODE_BIN` 指定运行时路径。

## 先试一个示例

下面的示例只有几何图片和虚构记录，没有真人照片或真实衣物。`demo-data` 必须是尚未创建的目录。

```sh
npm run demo -- "$PWD/demo-data"
YIXU_DATA_DIR="$PWD/demo-data" node scripts/local.mjs start 4193
```

打开 http://127.0.0.1:4193/#outfits 。示例里有三件合成衣物和一套搭配。试着从衣橱打开衣物详情，再查看关联搭配。

停止示例服务：

```sh
YIXU_DATA_DIR="$PWD/demo-data" node scripts/local.mjs stop 4193
```

这些命令适用于 macOS 和 Linux。Windows 可以在 PowerShell 中先设置 `$env:YIXU_DATA_DIR`，再运行相同的 `node` 命令。

## 录入自己的衣物

1. 拍摄衣物，使用你选择的工具去背景。被遮挡的部分如需 AI 补全，先确认结果并记录处理方式。
2. 按 [维护说明](docs/MAINTENANCE.md) 准备录入清单，使用 `scripts/intake.mjs` 录入。
3. 通过 `scripts/save-owned-outfit.mjs` 保存已确认的搭配。记录引用真实衣物，不把参考图当作库存。

「未用到」和「仅用在 1–2 套」统计的是已保存搭配，不是实际穿着次数。使用次数低不代表应该丢弃，是否保留由你决定。

## 数据和隐私

数据默认保存在当前目录的 `private-data/`，不会被 Git 跟踪。可用绝对路径形式的 `YIXU_DATA_DIR` 指定其他目录。

公开仓库只包含代码、文档和合成测试工具。开发者的衣物照片、搭配图、数据库、聊天记录、私人候选页和旧 Git 历史均不包含在内。

服务只监听 `127.0.0.1`，面向单人本机使用，没有登录或多用户权限管理。不要直接放到公网，也不要把数据库或备份提交到仓库。详见 [安全边界](SECURITY.md)。

中英文仓库分别运行，数据不会自动同步。

## 开发

```sh
npm test
npm run check
```

测试使用临时数据库和合成图片，不读取你的衣橱。不需要构建工具；前端是原生 JavaScript 模块，后端使用 Node.js 内置 SQLite。

- [架构和数据关联](docs/ARCHITECTURE.md)
- [录入、备份和恢复](docs/MAINTENANCE.md)
- [演示步骤](docs/DEMO.md)

可选的缩略图脚本需要另外安装 `sharp`，日常启动和测试不需要。

仓库附带 [GitHub Actions 测试模板](docs/ci-workflow.yml.example)。如需自动运行，将模板复制到 `.github/workflows/test.yml`；上传工作流需要相应的 GitHub 权限。当前仓库未启用该工作流。

## 许可证

本项目使用 [MIT 许可证](LICENSE)。开发者的私人数据和照片不在本仓库的发布范围内。
