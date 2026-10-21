# 维护衣橱数据

网页只负责浏览。录入衣物、保存搭配和修改状态时，命令行工具会通过本机服务写入同一个 SQLite 数据库。运行命令前，先确认你连接的是哪一个数据目录和端口。

## 确认服务与数据目录

`npm start` 启动默认服务，地址是 [http://127.0.0.1:4183](http://127.0.0.1:4183)。`npm run status` 查询状态，`npm stop` 停止服务。日常使用需要 Node.js 24 或更新版本，不需要额外安装运行时 npm 依赖；缩略图脚本单独需要 `sharp`。

数据默认放在仓库的 `private-data/`。要换位置，请把 `YIXU_DATA_DIR` 设为绝对路径，并用同一个值启动服务和执行涉及图片的命令。服务不是默认端口时，再设置 `YIXU_ORIGIN`，例如 `http://127.0.0.1:4193`。不要让维护命令连到另一个正在运行的衣橱。

数据库文件是 `wardrobe.sqlite`，图片在数据目录的 `public/` 下。网页只能读取数据库登记过的准确图片地址，不能浏览整个图片目录。浏览器收到的目录数据是数据库的只读结果，不要把返回的 JSON 当作另一份可编辑的衣橱。

## 录入衣物

先保留原图，再制作透明背景的 PNG，并逐件核对处理结果。准备一个 JSON 清单，至少包含：

- `collection: "owned"`、`name`、`layer`、`subtype`、`fit` 和 `pattern`。
- `color`，其中有 `name`、`family` 和六位十六进制 `hex`。
- 数组 `styles`、`seasons`、`uncertainties`。
- 原图与处理图的路径 `originalPath`、`cutoutPath`；处理方式 `processingMethod`；审核记录 `review: { "approved": true, "notes": "..." }`。

原图可用 PNG 或 JPEG；处理图须为有透明背景的非交错 RGBA PNG。`processingMethod` 可为 `background-extraction`、`segmentation` 或 `ai-reconstruction`。如果 AI 补全了原图看不到的部分，必须在审核记录中明确授权并标出已确认的细节。同一张照片分出多件衣物时，用不同的 `sourceItemKey` 区分。

清单准备好后，在对应服务运行期间执行：

```sh
node scripts/intake.mjs /absolute/path/reviewed-item.json
```

命令会检查字段、图片和已有来源，给新衣物分配稳定编号，再登记图片和衣物。重复来源会返回已有记录，不会悄悄再加一件。

## 常用维护命令

| 要做的事 | 命令 | 结果 |
| --- | --- | --- |
| 核对衣物或搭配编号 | `node scripts/lookup-codes.mjs SY01 DP01` | 只读取当前记录。 |
| 暂放「准备丢弃」 | `node scripts/set-garment-status.mjs pending-discard SY01` | 保留衣物档案；`active` 可恢复在用状态。 |
| 登记搭配图 | `node scripts/register-media.mjs /absolute/reviewed.png assets/outfits/look-v1.png` | 先登记不可覆盖的图片，再用于搭配。 |
| 保存已审核的搭配 | `node scripts/save-owned-outfit.mjs /absolute/look.json` | 核对衣物编号、图片及当前版本后写入。 |
| 移除指定搭配 | `node scripts/remove-owned-outfits.mjs DP01` | 只移除明确指定的搭配，保留衣物和编号占用记录。 |
| 检查私人数据 | `node scripts/check.mjs --data-dir /absolute/private-directory` | 检查数据库关联、登记图片的哈希和当前透明图。 |

保存普通搭配时，`selection` 引用已录入的真实衣物。明确设为 `outfitKind: "planned"` 的搭配可以含有经过校验的 `suggestedPieces`；待购单品只在这套搭配里展示，不会变成衣橱库存。

更少见的移除衣物、恢复已删除衣物、撤下旧图片和替换衣物图需要准确的旧记录与影响范围，不能只凭一个模糊名称操作。相关命令会核对预期状态，并保留历史编号和图片版本。每次写入前会留下数据库快照；图片文件不会随数据库事务自动回滚，所以失败后可能留下未登记的文件，需单独核查。

## 备份与恢复

备份会复制一致的 SQLite 数据库以及所有已登记图片，并核对图片哈希。目标必须是新的绝对路径：

```sh
node scripts/backup-private.mjs /absolute/new/backup-directory
```

恢复也写入新目录，不覆盖当前衣橱：

```sh
node scripts/restore-private.mjs /absolute/backup-directory /absolute/new/restored-directory
```

先检查恢复副本，再停止当前服务，把 `YIXU_DATA_DIR` 指向新目录。确认备份以后发生的修改已处理之前，保留旧目录。处理过程中的原始资料和未登记文件，还需要用常规文件备份另行保存。

如果你从旧版 v1 私人项目迁移，先停止写入、保留原项目和一致的数据库备份，再使用 `scripts/migrate-private-data.mjs` 迁移到尚不存在的新目录。不要让旧程序重新打开迁移后的 v2 数据库。

## 开发与发布

`npm test` 使用临时数据库和合成图片。`npm run check` 只检查应用源码；要检查自己的衣橱，须传入上文的 `--data-dir` 参数。更多数据关系见[架构说明](ARCHITECTURE.md)。

公开源码时，可用 `node scripts/export-source.mjs /absolute/new/source-export` 生成允许发布的文件清单，并逐项检查导出结果。不要发布私人开发仓库的历史提交；已删除的照片仍可能留在旧历史里。
