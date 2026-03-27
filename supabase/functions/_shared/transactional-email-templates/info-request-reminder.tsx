import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Link, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface InfoRequestReminderProps {
  firstName?: string
  companyName?: string
  carrierName?: string
  requestDetails?: string
  daysPending?: string
  portalLink?: string
}

const InfoRequestReminderEmail = ({ firstName, companyName, carrierName, requestDetails, daysPending, portalLink }: InfoRequestReminderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reminder — a carrier still needs additional information for your trucking insurance quote</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME}</Heading>
        <Hr style={divider} />

        <Text style={text}>
          Hi {firstName || 'there'},
        </Text>

        <Text style={text}>
          This is a friendly reminder that {carrierName ? `${carrierName}` : 'a carrier'} reviewing your
          {companyName ? ` ${companyName}` : ''} trucking insurance application still needs additional information
          {daysPending ? ` (requested ${daysPending} days ago)` : ''}.
        </Text>

        {requestDetails && (
          <Section style={detailsSection}>
            <Text style={detailsLabel}>What's needed:</Text>
            <Text style={detailsText}>{requestDetails}</Text>
          </Section>
        )}

        <Text style={text}>
          Providing this information promptly will help us move forward with your quote. Please log in to your portal to respond.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={portalLink || '#'}>
            Respond Now
          </Button>
        </Section>

        <Text style={text}>
          If you have questions, reply to this email or call us at{' '}
          <Link href="tel:9166722440" style={link}>916-672-2440</Link>.
        </Text>

        <Hr style={divider} />

        <Text style={footer}>
          {SITE_NAME}
        </Text>
        <Text style={footerLink}>
          <Link href="https://www.360riskpartners.com" style={link}>www.360riskpartners.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InfoRequestReminderEmail,
  subject: (data: Record<string, any>) =>
    data?.carrierName
      ? `Reminder: ${data.carrierName} still needs information from you`
      : 'Reminder: Additional information still needed for your quote',
  displayName: 'Info request reminder',
  previewData: {
    firstName: 'John',
    companyName: 'ABC Trucking LLC',
    carrierName: 'Great West Casualty',
    requestDetails: 'Please provide updated loss runs for the past 3 years and a current driver MVR.',
    daysPending: '3',
    portalLink: 'https://truckshield.lovable.app/client',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0a1628', margin: '0 0 8px', letterSpacing: '-0.5px' }
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const detailsSection = { backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '16px', margin: '0 0 16px' }
const detailsLabel = { fontSize: '13px', fontWeight: '600' as const, color: '#92400e', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const detailsText = { fontSize: '14px', color: '#78350f', lineHeight: '1.6', margin: '0' }
const buttonSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#d97706',
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
const footerLink = { fontSize: '13px', color: '#6b7280', margin: '0' }
