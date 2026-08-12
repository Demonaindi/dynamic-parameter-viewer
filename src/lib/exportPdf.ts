import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ChartMark, CompareMark, ParsedLog } from './types'
import {
  PDF_MARK_PARAMS_PER_TABLE,
  PDF_MARK_PARAMS_PER_TABLE_COMPARE,
  chunkParams,
  formatElapsed,
  formatSampleValue,
  markLabel,
  resolveParams,
  sampleAtAxisTime,
} from './chartOption'

type WorkshopInfo = {
  razonSocial: string
  operador: string
  direccion: string
  ciudad: string
  provincia: string
  telefono: string
  email: string
  matricula: string
  vin: string
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

function get(meta: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (meta[k]) return meta[k]
  }
  return ''
}

function fileLabelFrom(meta: Record<string, string>): string {
  const marca = get(meta, 'MARCA') || 'VEHICULO'
  const modelo = get(meta, 'MODELO') || ''
  return `${marca}_${modelo}_${new Date().toLocaleDateString('es-AR')}`.replace(
    /\s+/g,
    '_',
  )
}

function drawFooter(doc: jsPDF, label: string, page: number, margin: number) {
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`${label}.pdf • ${page}`, margin, pageH - 18)
}

async function loadTexaLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('./texa-logo.png?v=1.5.0')
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function drawTexaLogo(
  doc: jsPDF,
  logoDataUrl: string | null,
  pageW: number,
  margin: number,
  y = 18,
  size = 36,
) {
  if (!logoDataUrl) return
  doc.addImage(logoDataUrl, 'PNG', pageW - margin - size, y, size, size)
}

export async function exportPdfReport(
  log: ParsedLog,
  chartPages: string[],
  workshop: WorkshopInfo,
  t: TFn,
  opts?: {
    marks?: ChartMark[]
    selected?: string[]
    inicioOverride?: string
    finOverride?: string
  },
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 36
  const label = fileLabelFrom(log.meta)
  const logoDataUrl = await loadTexaLogoDataUrl()
  const marks = opts?.marks ?? []
  const selected = opts?.selected ?? []
  const inicio = opts?.inicioOverride || get(log.meta, 'INICIO VIAJE')
  const fin = opts?.finOverride || get(log.meta, 'FIN VIAJE')
  let page = 1

  const drawSignature = (y: number) => {
    const sigY = Math.min(y, pageH - 48)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(33, 33, 33)
    doc.text(t('pdf.sello'), pageW - margin - 120, sigY)
    doc.text('_______________________________', pageW - margin - 160, sigY + 28)
  }

  drawTexaLogo(doc, logoDataUrl, pageW, margin, 14, 40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(12, 37, 119)
  doc.text(t('pdf.title'), pageW / 2, 42, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90, 106, 128)
  doc.text('Dynamic Parameter viewer', pageW / 2, 54, { align: 'center' })

  const meta = log.meta
  const tallerRows = [
    [t('workshop.razonSocial'), workshop.razonSocial || '—', t('workshop.operador'), workshop.operador || '—'],
    [t('workshop.direccion'), workshop.direccion || '—', t('workshop.provincia'), workshop.provincia || '—'],
    [t('workshop.ciudad'), workshop.ciudad || '—', t('workshop.telefono'), workshop.telefono || '—'],
    [t('workshop.email'), workshop.email || '—', '', ''],
  ]

  autoTable(doc, {
    startY: 64,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, textColor: [40, 40, 40] },
    headStyles: {
      fillColor: [12, 37, 119],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    head: [[{ content: t('pdf.taller'), colSpan: 4 }]],
    body: tallerRows,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70, fillColor: [238, 242, 250] },
      2: { fontStyle: 'bold', cellWidth: 70, fillColor: [238, 242, 250] },
    },
    margin: { left: margin, right: margin },
  })

  const vehRows = [
    [t('workshop.matricula'), workshop.matricula || '—', t('workshop.vin'), workshop.vin || '—'],
    [t('meta.MARCA'), get(meta, 'MARCA'), t('meta.MODELO'), get(meta, 'MODELO')],
    [
      t('meta.MOTORIZACION'),
      get(meta, 'MOTORIZACION'),
      t('meta.CODIGO MOTOR'),
      get(meta, 'CODIGO MOTOR'),
    ],
    [
      t('meta.TIPO SISTEMA'),
      get(meta, 'TIPO SISTEMA'),
      t('meta.SISTEMA'),
      get(meta, 'SISTEMA'),
    ],
    [t('meta.PERIODO'), get(meta, 'PERIODO'), '', ''],
  ]

  const afterTaller = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY

  autoTable(doc, {
    startY: afterTaller + 10,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, textColor: [40, 40, 40] },
    headStyles: {
      fillColor: [12, 37, 119],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    head: [[{ content: t('pdf.vehiculo'), colSpan: 4 }]],
    body: vehRows,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80, fillColor: [238, 242, 250] },
      2: { fontStyle: 'bold', cellWidth: 80, fillColor: [238, 242, 250] },
    },
    margin: { left: margin, right: margin },
  })

  const afterVeh = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  autoTable(doc, {
    startY: afterVeh + 10,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [12, 37, 119],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    head: [[{ content: t('pdf.prueba'), colSpan: 4 }]],
    body: [
      [
        t('pdf.inicio'),
        inicio || '—',
        t('pdf.fin'),
        fin || '—',
      ],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80, fillColor: [238, 242, 250] },
      2: { fontStyle: 'bold', cellWidth: 80, fillColor: [238, 242, 250] },
    },
    margin: { left: margin, right: margin },
  })

  const afterTest = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  doc.setFillColor(12, 37, 119)
  doc.rect(margin, afterTest + 10, pageW - margin * 2, 18, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(t('pdf.autodiagnosis'), margin + 6, afterTest + 22)

  const chartTopFirst = afterTest + 34
  const chartW = pageW - margin * 2
  const maxChartHFirst = pageH - chartTopFirst - 70
  const maxChartHFull = pageH - margin - 50
  let lastChartBottom = chartTopFirst

  chartPages.forEach((url, idx) => {
    if (idx > 0) {
      doc.addPage()
      page += 1
      drawTexaLogo(doc, logoDataUrl, pageW, margin, 12, 32)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(12, 37, 119)
      doc.text(t('pdf.titleCont'), pageW / 2, margin + 8, {
        align: 'center',
      })
    }

    const top = idx === 0 ? chartTopFirst : margin + 24
    const maxH = idx === 0 ? maxChartHFirst : maxChartHFull
    const img = doc.getImageProperties(url)
    const ratio = img.width / img.height
    let drawW = chartW
    let drawH = drawW / ratio
    if (drawH > maxH) {
      drawH = maxH
      drawW = drawH * ratio
    }

    doc.addImage(url, 'PNG', margin, top, drawW, drawH)
    lastChartBottom = top + drawH
    drawFooter(doc, label, page, margin)
  })

  if (marks.length > 0) {
    const params = resolveParams(log, selected)
    const chunks = chunkParams(params, PDF_MARK_PARAMS_PER_TABLE)

    const needNewPage =
      chartPages.length === 0 || lastChartBottom > pageH - 160 || marks.length > 4

    if (needNewPage) {
      doc.addPage()
      page += 1
      drawTexaLogo(doc, logoDataUrl, pageW, margin, 12, 32)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(12, 37, 119)
      doc.text(t('pdf.marksTitle'), pageW / 2, margin + 8, { align: 'center' })
    }

    let startY = needNewPage
      ? margin + 28
      : Math.min(lastChartBottom + 16, pageH - 140)

    chunks.forEach((chunk, chunkIdx) => {
      if (chunkIdx > 0) {
        const prevY = (doc as jsPDF & { lastAutoTable: { finalY: number } })
          .lastAutoTable.finalY
        if (prevY > pageH - 140) {
          drawFooter(doc, label, page, margin)
          doc.addPage()
          page += 1
          drawTexaLogo(doc, logoDataUrl, pageW, margin, 12, 32)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
          doc.setTextColor(12, 37, 119)
          doc.text(t('pdf.marksTitleCont'), pageW / 2, margin + 8, {
            align: 'center',
          })
          startY = margin + 28
        } else {
          startY = prevY + 14
        }
      }

      const head = [
        t('pdf.mark'),
        t('pdf.markTime'),
        ...chunk.map((p) => (p.unit ? `${p.name} (${p.unit})` : p.name)),
      ]
      const body = marks.map((m, i) => [
        markLabel(i + 1),
        log.timeLabels[m.index] ?? '—',
        ...chunk.map((p) => formatSampleValue(p.values[m.index])),
      ])

      autoTable(doc, {
        startY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2.5, textColor: [40, 40, 40] },
        headStyles: {
          fillColor: [230, 81, 0],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        head: [head],
        body,
        margin: { left: margin, right: margin },
      })
    })

    const afterMarks = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY
    drawSignature(afterMarks + 28)
    drawFooter(doc, label, page, margin)
  } else if (chartPages.length > 0) {
    drawSignature(lastChartBottom + 28)
  } else {
    drawFooter(doc, label, page, margin)
  }

  doc.save(`${label}.pdf`)
}

export async function exportComparePdfReport(
  logA: ParsedLog,
  logB: ParsedLog,
  chartPages: string[],
  workshop: WorkshopInfo,
  t: TFn,
  opts: {
    labelA: string
    labelB: string
    offsetA: number
    offsetB: number
    visibility: string
    marks?: CompareMark[]
    selected?: string[]
    inicioOverride?: string
    finOverride?: string
  },
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 36
  const marcaA = get(logA.meta, 'MARCA') || 'A'
  const modeloA = get(logA.meta, 'MODELO') || ''
  const label = `COMPARE_${marcaA}_${modeloA}_${new Date().toLocaleDateString('es-AR')}`.replace(
    /\s+/g,
    '_',
  )
  const logoDataUrl = await loadTexaLogoDataUrl()
  const marks = opts.marks ?? []
  const selected = opts.selected ?? []
  const inicio = opts.inicioOverride || get(logA.meta, 'INICIO VIAJE') || '—'
  const fin = opts.finOverride || get(logA.meta, 'FIN VIAJE') || '—'
  let page = 1

  const drawSignature = (y: number) => {
    const sigY = Math.min(y, pageH - 48)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(33, 33, 33)
    doc.text(t('pdf.sello'), pageW - margin - 120, sigY)
    doc.text('_______________________________', pageW - margin - 160, sigY + 28)
  }

  drawTexaLogo(doc, logoDataUrl, pageW, margin, 14, 40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(12, 37, 119)
  doc.text(t('pdf.compareTitle'), pageW / 2, 42, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90, 106, 128)
  doc.text('Dynamic Parameter viewer', pageW / 2, 54, { align: 'center' })

  const tallerRows = [
    [t('workshop.razonSocial'), workshop.razonSocial || '—', t('workshop.operador'), workshop.operador || '—'],
    [t('workshop.direccion'), workshop.direccion || '—', t('workshop.provincia'), workshop.provincia || '—'],
    [t('workshop.ciudad'), workshop.ciudad || '—', t('workshop.telefono'), workshop.telefono || '—'],
    [t('workshop.email'), workshop.email || '—', '', ''],
  ]

  autoTable(doc, {
    startY: 64,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, textColor: [40, 40, 40] },
    headStyles: {
      fillColor: [12, 37, 119],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    head: [[{ content: t('pdf.taller'), colSpan: 4 }]],
    body: tallerRows,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70, fillColor: [238, 242, 250] },
      2: { fontStyle: 'bold', cellWidth: 70, fillColor: [238, 242, 250] },
    },
    margin: { left: margin, right: margin },
  })

  const afterTaller = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY

  const visLabel =
    opts.visibility === 'a'
      ? t('vis.a')
      : opts.visibility === 'b'
        ? t('vis.b')
        : t('vis.both')

  autoTable(doc, {
    startY: afterTaller + 10,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, textColor: [40, 40, 40] },
    headStyles: {
      fillColor: [12, 37, 119],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    head: [[{ content: t('pdf.compareLogs'), colSpan: 4 }]],
    body: [
      ['A', opts.labelA, t('pdf.inicio'), inicio],
      [
        '',
        `${get(logA.meta, 'MARCA')} ${get(logA.meta, 'MODELO')}`.trim() || logA.sourceName,
        t('pdf.fin'),
        fin,
      ],
      ['B', opts.labelB, t('pdf.inicio'), opts.inicioOverride || get(logB.meta, 'INICIO VIAJE') || '—'],
      [
        '',
        `${get(logB.meta, 'MARCA')} ${get(logB.meta, 'MODELO')}`.trim() || logB.sourceName,
        t('pdf.fin'),
        opts.finOverride || get(logB.meta, 'FIN VIAJE') || '—',
      ],
      [
        t('vis.title'),
        visLabel,
        t('shift.title'),
        `A ${opts.offsetA >= 0 ? '+' : ''}${opts.offsetA.toFixed(1)}s · B ${opts.offsetB >= 0 ? '+' : ''}${opts.offsetB.toFixed(1)}s`,
      ],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70, fillColor: [238, 242, 250] },
      2: { fontStyle: 'bold', cellWidth: 70, fillColor: [238, 242, 250] },
    },
    margin: { left: margin, right: margin },
  })

  const afterCompare = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY

  doc.setFillColor(12, 37, 119)
  doc.rect(margin, afterCompare + 10, pageW - margin * 2, 18, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(t('pdf.autodiagnosis'), margin + 6, afterCompare + 22)

  const chartTopFirst = afterCompare + 34
  const chartW = pageW - margin * 2
  const maxChartHFirst = pageH - chartTopFirst - 70
  const maxChartHFull = pageH - margin - 50
  let lastChartBottom = chartTopFirst

  chartPages.forEach((url, idx) => {
    if (idx > 0) {
      doc.addPage()
      page += 1
      drawTexaLogo(doc, logoDataUrl, pageW, margin, 12, 32)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(12, 37, 119)
      doc.text(t('pdf.compareTitleCont'), pageW / 2, margin + 8, {
        align: 'center',
      })
    }

    const top = idx === 0 ? chartTopFirst : margin + 24
    const maxH = idx === 0 ? maxChartHFirst : maxChartHFull
    const img = doc.getImageProperties(url)
    const ratio = img.width / img.height
    let drawW = chartW
    let drawH = drawW / ratio
    if (drawH > maxH) {
      drawH = maxH
      drawW = drawH * ratio
    }

    doc.addImage(url, 'PNG', margin, top, drawW, drawH)
    lastChartBottom = top + drawH
    drawFooter(doc, label, page, margin)
  })

  if (marks.length > 0) {
    const chunks = chunkParams(selected, PDF_MARK_PARAMS_PER_TABLE_COMPARE)

    const needNewPage =
      chartPages.length === 0 || lastChartBottom > pageH - 160 || marks.length > 4

    if (needNewPage) {
      doc.addPage()
      page += 1
      drawTexaLogo(doc, logoDataUrl, pageW, margin, 12, 32)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(12, 37, 119)
      doc.text(t('pdf.marksTitle'), pageW / 2, margin + 8, { align: 'center' })
    }

    let startY = needNewPage
      ? margin + 28
      : Math.min(lastChartBottom + 16, pageH - 140)

    chunks.forEach((chunk, chunkIdx) => {
      if (chunkIdx > 0) {
        const prevY = (doc as jsPDF & { lastAutoTable: { finalY: number } })
          .lastAutoTable.finalY
        if (prevY > pageH - 140) {
          drawFooter(doc, label, page, margin)
          doc.addPage()
          page += 1
          drawTexaLogo(doc, logoDataUrl, pageW, margin, 12, 32)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(12)
          doc.setTextColor(12, 37, 119)
          doc.text(t('pdf.marksTitleCont'), pageW / 2, margin + 8, {
            align: 'center',
          })
          startY = margin + 28
        } else {
          startY = prevY + 14
        }
      }

      const head = [t('pdf.mark'), t('pdf.markTime')]
      for (const name of chunk) {
        const unit =
          logA.parameters.find((p) => p.name === name)?.unit ||
          logB.parameters.find((p) => p.name === name)?.unit ||
          ''
        const labelParam = unit ? `${name} (${unit})` : name
        if (opts.visibility !== 'b') head.push(`${labelParam} A`)
        if (opts.visibility !== 'a') head.push(`${labelParam} B`)
      }

      const body = marks.map((m, i) => {
        const row: string[] = [markLabel(i + 1), formatElapsed(m.time)]
        for (const name of chunk) {
          if (opts.visibility !== 'b') {
            row.push(
              formatSampleValue(
                sampleAtAxisTime(logA, name, m.time, opts.offsetA),
              ),
            )
          }
          if (opts.visibility !== 'a') {
            row.push(
              formatSampleValue(
                sampleAtAxisTime(logB, name, m.time, opts.offsetB),
              ),
            )
          }
        }
        return row
      })

      autoTable(doc, {
        startY,
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 2, textColor: [40, 40, 40] },
        headStyles: {
          fillColor: [230, 81, 0],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        head: [head],
        body,
        margin: { left: margin, right: margin },
      })
    })

    const afterMarks = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY
    drawSignature(afterMarks + 28)
    drawFooter(doc, label, page, margin)
  } else if (chartPages.length > 0) {
    drawSignature(lastChartBottom + 28)
  } else {
    drawFooter(doc, label, page, margin)
  }

  doc.save(`${label}.pdf`)
}
