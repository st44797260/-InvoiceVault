# InvoiceVault

本地优先的发票管理与归档工具。上传 PDF 发票后自动提取文本、识别关键字段与商品明细，并支持人工校正、自动分类、重复检测、统计看板与 CSV 导出。**全部数据仅保存在你自己的浏览器中，不经过任何服务器。**

## 功能特性

- **上传解析**：拖拽/批量上传 PDF，pdfjs-dist 提取文本层，正则抽取发票号码、日期、销售方/购买方、金额税额与商品明细
- **人工校正**：发票详情页左侧 PDF 画布预览（翻页/缩放），右侧字段编辑表单与明细行编辑
- **自动分类**：按销售方与商品关键词自动归类（餐饮/交通/住宿/办公/服务/其他）
- **重复检测**：发票代码 + 发票号码查重，重复发票红色标记
- **发票管理**：筛选（日期/状态/分类/关键词）、分页、批量归档/改分类/删除、CSV 导出
- **统计看板**：金额趋势、分类分布、供应商 TOP5、最近上传，数字滚动与图表生长动画
- **统计报表**：多维度筛选，按分类/月份统计，导出 CSV

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | React 19 + Vite 8 |
| 样式 | Tailwind CSS v4（CSS-first 主题配置） |
| 路由 | React Router v7 |
| 本地存储 | Dexie.js（IndexedDB 封装）+ dexie-react-hooks |
| PDF | pdfjs-dist（文本提取 + Canvas 预览渲染） |
| 图表 | Recharts |
| 动效 | Framer Motion |
| 其他 | lucide-react（图标）、react-dropzone（拖拽上传）、date-fns（日期） |

## 本地运行

```bash
pnpm install
pnpm dev
```

浏览器打开 http://localhost:5173 即可使用。

## 构建与预览

```bash
pnpm build     # 产物输出到 dist/
pnpm preview   # 本地预览生产构建
```

代码检查：

```bash
pnpm lint
```

## 数据存储说明

- 所有发票记录、原始 PDF 字节与设置均保存在浏览器的 **IndexedDB**（库名 `InvoiceVaultDB`），包含 `invoices`（发票）、`items`（商品明细）、`settings` 三张表。
- **不上传任何数据到服务器**，也不会发送分析统计；应用没有后端。
- 数据与浏览器配置文件绑定：清除浏览器数据、使用无痕窗口或更换浏览器都会得到空库；如需迁移，请使用 CSV 导出（明细与原文件目前不包含在导出中）。
- `public/` 目录中的 `sample-invoice.pdf` 与 `sample-scanned.pdf` 是用于测试解析流程的样例文件。

## 部署说明

项目是纯静态单页应用（SPA），可部署到任何静态托管服务。

**Vercel（推荐）**：仓库已包含 `vercel.json`，将 SPA 路由重写到 `index.html`，直接导入 Git 仓库即可，构建命令 `pnpm build`，输出目录 `dist`。

**其他平台**（Netlify、Cloudflare Pages、Nginx 等）：

1. 构建命令 `pnpm build`，发布 `dist/` 目录；
2. 配置所有路径回退到 `index.html`（如 Netlify 的 `_redirects`：`/* /index.html 200`，Nginx 的 `try_files $uri $uri/ /index.html;`）。

> 注意：pdfjs-dist 的 worker 通过 `?url` 方式引入，构建后以独立资源文件发布（见 `src/lib/pdf.js`），无需额外配置；如部署在子路径下，请同步设置 Vite 的 `base` 选项。
