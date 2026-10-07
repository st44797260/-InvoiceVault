/**
 * 生成端到端测试用的样例 PDF（dev 依赖，一次性工具）
 *   public/sample-invoice.pdf  — 含中文发票文本，可被正则提取
 *   public/sample-scanned.pdf  — 空白页，模拟无文本层的扫描件
 *
 * 运行：node scripts/make-sample-pdfs.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const FONT_PATH = 'C:/Windows/Fonts/simhei.ttf'

const INVOICE_LINES = [
  '电子发票（普通发票）',
  '发票号码：25632000000123456789',
  '开票日期：2025年9月18日',
  '购买方名称：杭州云启科技有限公司',
  '统一社会信用代码/纳税人识别号：91330106MA2H3ABCD9',
  '销售方名称：上海星辰信息技术有限公司',
  '统一社会信用代码/纳税人识别号：91310115MA1K4XY8E2',
  '项目名称',
  '1 *信息技术服务*云服务部署实施费 1 1000.00 1000.00 13% 130.00',
  '2 *办公耗材*A4复印纸 70g 10 12.00 120.00 13% 15.60',
  '金额合计：¥1120.00',
  '税额合计：¥145.60',
  '价税合计（大写）壹仟贰佰陆拾伍元陆角（小写）¥1265.60',
  '备注：测试样例文件，用于验证文本解析与字段提取。',
]

async function makeInvoicePdf() {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(await readFile(FONT_PATH), { subset: true })

  const page = doc.addPage([595, 842])
  INVOICE_LINES.forEach((line, i) => {
    page.drawText(line, {
      x: 56,
      y: 780 - i * 26,
      size: 13,
      font,
      color: rgb(0.06, 0.09, 0.16),
    })
  })

  return doc.save()
}

async function makeScannedPdf() {
  // 只有页面没有文本层，模拟纯图片扫描件
  const doc = await PDFDocument.create()
  doc.addPage([595, 842])
  return doc.save()
}

await writeFile('public/sample-invoice.pdf', await makeInvoicePdf())
await writeFile('public/sample-scanned.pdf', await makeScannedPdf())
console.log('written: public/sample-invoice.pdf, public/sample-scanned.pdf')
