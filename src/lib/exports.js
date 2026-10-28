import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Papa from 'papaparse'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

import { formatCurrency } from './currency'
import { formatDate } from './date'

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1])
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

const downloadBlob = async (filename, content, type) => {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: `exports/${filename}`,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true,
    })
    await Share.share({
      title: filename,
      files: [result.uri],
      dialogTitle: 'Save or share your Contri export',
    })
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export const exportExpensesCsv = async ({ trip, expenses = [], membersMap }) => {
  const rows = expenses.map((expense) => ({
    Title: expense.title,
    Amount: expense.amount,
    Currency: trip.currency,
    Category: expense.category,
    PaidBy: membersMap[expense.paidBy]?.name || expense.paidBy,
    Date: expense.date || formatDate(expense.createdAt || expense.updatedAt),
    SplitMode: expense.splitMode,
    Note: expense.note || '',
    ReceiptURL: expense.receiptURL || '',
  }))

  const csv = Papa.unparse(rows)
  await downloadBlob(
    `${trip.name.toLowerCase().replace(/[^\w]+/g, '-')}-expenses.csv`,
    csv,
    'text/csv;charset=utf-8;',
  )
}

export const exportTripSummaryPdf = async ({
  trip,
  expenses = [],
  balances = [],
  suggestions = [],
  membersMap,
}) => {
  const doc = new jsPDF()

  doc.setFontSize(22)
  doc.text(trip.name, 14, 20)
  doc.setFontSize(11)
  doc.text(`Currency: ${trip.currency}`, 14, 28)
  doc.text(
    `Dates: ${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}`,
    14,
    34,
  )

  autoTable(doc, {
    startY: 42,
    head: [['Expense', 'Category', 'Paid By', 'Date', 'Amount']],
    body: expenses.map((expense) => [
      expense.title,
      expense.category,
      membersMap[expense.paidBy]?.name || expense.paidBy,
      expense.date || formatDate(expense.createdAt || expense.updatedAt),
      formatCurrency(expense.amount, trip.currency),
    ]),
  })

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 10,
    head: [['Member', 'Paid', 'Share', 'Net']],
    body: balances.map((entry) => [
      entry.name,
      formatCurrency(entry.paid, trip.currency),
      formatCurrency(entry.share, trip.currency),
      formatCurrency(entry.net, trip.currency),
    ]),
  })

  if (suggestions.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['From', 'To', 'Amount']],
      body: suggestions.map((item) => [
        membersMap[item.from]?.name || item.from,
        membersMap[item.to]?.name || item.to,
        formatCurrency(item.amount, trip.currency),
      ]),
    })
  }

  await downloadBlob(
    `${trip.name.toLowerCase().replace(/[^\w]+/g, '-')}-summary.pdf`,
    doc.output('blob'),
    'application/pdf',
  )
}
