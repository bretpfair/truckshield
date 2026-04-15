import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Link, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

const statusLabels: Record<string, string> = {
  submitted: 'Submitted for Review',
  reviewing: 'Under Review',
  quoted: 'Quote Available',
  quote_updated: 'Quote Updated',
  declined: 'Declined',
  bound: 'Bound',
}

interface CarrierStatusChangeProps {
  firstName?: string
  carrierName?: string
  newStatus?: string
  portalLink?: string
}

const CarrierStatusChangeEmail = ({ firstName, carrierName, newStatus, portalLink }: CarrierStatusChangeProps) => {
  const label = (newStatus && statusLabels[newStatus]) || 'Updated'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{carrierName ? `${carrierName} — status update: ${label}` : `Carrier status update: ${label}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{SITE_NAME}</Heading>
          <Hr style={divider} />

          <Text style={text}>
            Hi {firstName || 'there'},
          </Text>

          <Text style={text}>
            <strong>{carrierName || 'Carrier'}</strong> has updated the status of your quote to <strong>{label}</strong>.
          </Text>

          <Text style={text}>
            Log in to your portal to see the full details and any next steps.
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={portalLink || '#'}>
              View Full Details in Portal →
            </Button>
          </Section>

          <Text style={text}>
            We'll keep you posted on any next steps.
          </Text>

          <Text style={text}>
            Best regards,<br />
            The 360 Risk Partners Team
          </Text>

          <Hr style={divider} />

          <Text style={footer}>{SITE_NAME}</Text>
          <Text style={footerContact}>
            <Link href="mailto:Info@360riskpartners.com" style={link}>Info@360riskpartners.com</Link>
            {' '} | {' '}
            <Link href="tel:8888854144" style={link}>888-885-4144</Link>
          </Text>
          <Text style={footerLinkText}>
            <Link href="https://www.360riskpartners.com" style={link}>www.360riskpartners.com</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CarrierStatusChangeEmail,
  subject: (data: Record<string, any>) => {
    const label = (data?.newStatus && statusLabels[data.newStatus]) || 'Updated'
    return data?.carrierName
      ? `${data.carrierName} Quote Update — ${label}`
      : `Carrier Quote Update — ${label}`
  },
  displayName: 'Carrier status change',
  previewData: {
    firstName: 'John',
    carrierName: 'Great West Casualty',
    newStatus: 'quoted',
    portalLink: 'https://truckshield.360riskpartners.com/client',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0a1628', margin: '0 0 8px', letterSpacing: '-0.5px' }
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const buttonSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#0099cc',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  display: 'inline-block',
}
const link = { color: '#0099cc', textDecoration: 'underline' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '0 0 4px', fontWeight: '600' as const }
const footerContact = { fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }
const footerLinkText = { fontSize: '13px', color: '#6b7280', margin: '0' }