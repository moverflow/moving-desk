import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Invoice, Company } from '@/types'
import { formatCurrency } from '@/lib/utils'

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#111' },
  company: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  muted: { color: '#666', marginBottom: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: '#666', marginBottom: 2 },
  value: { marginBottom: 6 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  total: { flexDirection: 'row', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 12, marginTop: 8 },
  badge: { fontSize: 9, color: '#666', marginTop: 16 },
})

interface InvoiceDocumentProps {
  invoice: Invoice
  company: Company
}

export default function InvoiceDocument({ invoice, company }: InvoiceDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.company}>{company.name}</Text>
        <Text style={s.muted}>{company.phone} · {company.website}</Text>
        <View style={s.divider} />
        <View style={s.row}>
          <View>
            <Text style={s.label}>Invoice</Text>
            <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{invoice.number}</Text>
          </View>
          <View>
            <Text style={s.label}>Date</Text>
            <Text>{invoice.createdAt.slice(0, 10)}</Text>
          </View>
        </View>
        <View style={s.divider} />
        <Text style={s.label}>Bill To</Text>
        <Text style={s.value}>{invoice.clientName}</Text>
        <Text style={s.muted}>{invoice.clientPhone}</Text>
        <View style={s.divider} />
        <Text style={s.label}>Move Details</Text>
        <Text style={s.value}>From: {invoice.fromAddress}</Text>
        <Text style={s.value}>To: {invoice.toAddress}</Text>
        <Text style={s.value}>Date: {invoice.moveDate}</Text>
        <Text style={s.value}>Home size: {invoice.homeSize}</Text>
        <View style={s.divider} />
        <View style={s.lineRow}>
          <Text>Moving ({invoice.homeSize})</Text>
          <Text>{formatCurrency(invoice.basePrice)}</Text>
        </View>
        {invoice.packing && (
          <View style={s.lineRow}>
            <Text>Packing service</Text>
            <Text>{formatCurrency(invoice.totalPrice - invoice.basePrice)}</Text>
          </View>
        )}
        <View style={s.divider} />
        <View style={s.total}>
          <Text>Total</Text>
          <Text>{formatCurrency(invoice.totalPrice)}</Text>
        </View>
        <Text style={s.badge}>Status: {invoice.status.toUpperCase()}</Text>
      </Page>
    </Document>
  )
}
