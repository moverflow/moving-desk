import type { JSX } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CompanyTab from '@/components/shared/CompanyTab'
import TeamTab from '@/components/shared/TeamTab'
import BillingTab from '@/components/shared/BillingTab'
import CrewsTab from '@/components/shared/CrewsTab'
import BookingTab from '@/components/shared/BookingTab'
import IntegrationsTab from '@/components/shared/IntegrationsTab'
import PageContainer from '@/components/shared/PageContainer'

const cardStyle: React.CSSProperties = {
  background: 'white',
  border: '0.5px solid #e0e0dc',
  borderRadius: 12,
  padding: '28px 32px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
}

export default function SettingsPage(): JSX.Element {
  return (
    <PageContainer variant="narrow">
      <div className="py-8">
        <h1 className="text-xl font-semibold mb-4">Settings</h1>
        <div style={cardStyle}>
          <Tabs defaultValue="company">
            <TabsList>
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
              <TabsTrigger value="crews">Crews</TabsTrigger>
              <TabsTrigger value="booking">Booking</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
            </TabsList>
            <TabsContent value="company"><CompanyTab /></TabsContent>
            <TabsContent value="team"><TeamTab /></TabsContent>
            <TabsContent value="billing"><BillingTab /></TabsContent>
            <TabsContent value="crews"><CrewsTab /></TabsContent>
            <TabsContent value="booking"><BookingTab /></TabsContent>
            <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
          </Tabs>
        </div>
      </div>
    </PageContainer>
  )
}
