import type { JSX } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
}

const TAB_VALUES = ['company', 'team', 'billing', 'crews', 'booking', 'integrations']

function SettingsHeader(): JSX.Element {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Link
        to="/dashboard?tour=replay"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
      >
        Take the tour
      </Link>
    </div>
  )
}

interface SettingsTabsProps {
  activeTab: string
  onTabChange: (value: string) => void
}

function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps): JSX.Element {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <div className="overflow-x-auto">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="crews">Crews</TabsTrigger>
          <TabsTrigger value="booking">Booking</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="company"><CompanyTab /></TabsContent>
      <TabsContent value="team"><TeamTab /></TabsContent>
      <TabsContent value="billing"><BillingTab /></TabsContent>
      <TabsContent value="crews"><CrewsTab /></TabsContent>
      <TabsContent value="booking"><BookingTab /></TabsContent>
      <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
    </Tabs>
  )
}

export default function SettingsPage(): JSX.Element {
  // ?tab=<value> deep link — same pattern as InvoicesPage's ?invoice= and
  // OrdersPage's ?order=. Lets the first-login tour (and any future link)
  // land directly on a specific tab instead of always the default.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = tabParam && TAB_VALUES.includes(tabParam) ? tabParam : 'company'

  function handleTabChange(value: string): void {
    setSearchParams((prev) => {
      prev.set('tab', value)
      return prev
    })
  }

  return (
    <PageContainer variant="narrow">
      <div className="py-8">
        <SettingsHeader />
        <div className="p-4 sm:px-8 sm:py-7" style={cardStyle}>
          <SettingsTabs activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </div>
    </PageContainer>
  )
}
