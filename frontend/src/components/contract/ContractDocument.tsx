import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { PublicContract } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { STANDARD_CONTRACT_TERMS } from './terms'

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#111' },
  company: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  title: { fontSize: 13, fontWeight: 'bold', marginBottom: 12 },
  section: { fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: '#666' },
  term: { marginBottom: 6, lineHeight: 1.4 },
  sig: { width: 220, height: 90, objectFit: 'contain', borderWidth: 1, borderColor: '#e5e7eb' },
  muted: { color: '#666', marginTop: 4 },
})

interface ContractDocumentProps {
  contract: PublicContract
  signedName: string
  signatureDataUrl: string
  signedAt: string
}

export default function ContractDocument({
  contract,
  signedName,
  signatureDataUrl,
  signedAt,
}: ContractDocumentProps) {
  const { order, company } = contract
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.company}>{company.name}</Text>
        <Text style={s.title}>Moving Service Agreement</Text>

        <Text style={s.section}>Move details</Text>
        <View style={s.row}>
          <Text style={s.label}>From</Text>
          <Text>{order.fromAddress}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>To</Text>
          <Text>{order.toAddress}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Date</Text>
          <Text>{order.moveDate}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Size</Text>
          <Text>{order.homeSize}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Packing</Text>
          <Text>{order.packing ? 'Yes' : 'No'}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Price</Text>
          <Text>{formatCurrency(order.totalPrice)}</Text>
        </View>

        <Text style={s.section}>Standard terms</Text>
        {STANDARD_CONTRACT_TERMS.map((term, i) => (
          <Text key={term} style={s.term}>
            {i + 1}. {term}
          </Text>
        ))}

        {company.contractTerms ? (
          <>
            <Text style={s.section}>{company.name} terms</Text>
            <Text style={s.term}>{company.contractTerms}</Text>
          </>
        ) : null}

        <View style={s.divider} />
        <Text style={s.section}>Client signature</Text>
        {signatureDataUrl ? <Image style={s.sig} src={signatureDataUrl} /> : null}
        <Text style={s.muted}>Signed by {signedName}</Text>
        <Text style={s.muted}>{signedAt}</Text>
      </Page>
    </Document>
  )
}
