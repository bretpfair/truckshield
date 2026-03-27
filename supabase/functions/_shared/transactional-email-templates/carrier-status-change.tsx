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
  declined: 'Declined',
  bound: 'Bound',
}

const statusMessages: Record<string, string> = {
  submitted: 'Your application has been submitted to the carrier for review. We will keep you updated as things progress.',
  reviewing: 'The carrier is currently reviewing your application. No action is needed from you at this time. We will notify you as soon as there is an update.',
  quoted: 'Great news! A quote has been received for your trucking insurance. Log in to your portal to view the details and premium.',
  declined: 'Unfortunately, this carrier has declined to provide a quote at this time. Do not worry, we are continuing to work with other markets to find you the best coverage.',
  bound: 'Congratulations! Your policy has been bound. Log in to your portal for the full details.',
}

interface CarrierStatusChangeProps {
  firstName?: string
  carrierName?: string
  newStatus?: string
  portalLink?: string
}

const CarrierStatusChangeEmail = ({ firstName, carrierName, newStatus, portalLink }: CarrierStatusChangeProps) => {
  const label = (newStatus && statusLabels[newStatus]) || 'Updated'
  const message = (newStatus && statusMessages[newStatus]) || 'There has been an update on your insurance application. Log in to your portal to view the latest status.'
  const isPositive = newStatus === 'quoted' || newStatus === 'bound'

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

          <Section style={isPositive ? highlightSectionGreen : highlightSection}>
            <Text style={highlightLabel}>{carrierName || 'Carrier'}</Text>
            <Text style={highlightStatus}>Status: {label}</Text>
          </Section>

          <Text style={text}>{message}</Text>

          {(newStatus === 'quoted' || newStatus === 'bound' || newStatus === 'submitted') && (
            <Section style={buttonSection}>
              <Button style={isPositive ? buttonGreen : button} href={portalLink || '#'}>
                View in Your Portal
              </Button>
            </Section>
          )}

          <Text style={text}>
            If you have any questions, reply to this email or call us at{' '}
            <Link href="tel:9166722440" style={link}>916-672-2440</Link>.
          </Text>

          <Hr style={divider} />

          <Text style={footer}>{SITE_NAME}</Text>
          <Text style={footerLink}>
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
      ? `${data.carrierName} — ${label}`
      : `Carrier Status Update — ${label}`
  },
  displayName: 'Carrier status change',
  previewData: {
    firstName: 'John',
    carrierName: 'Great West Casualty',
    newStatus: 'quoted',
    portalLink: 'https://truckshield.lovable.app/client',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0a1628', margin: '0 0 8px', letterSpacing: '-0.5px' }
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const highlightSection = { backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '16px', margin: '0 0 16px' }
const highlightSectionGreen = { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '16px', margin: '0 0 16px' }
const highlightLabel = { fontSize: '16px', fontWeight: '600' as const, color: '#0a1628', margin: '0 0 4px' }
const highlightStatus = { fontSize: '14px', color: '#0099cc', margin: '0', fontWeight: '500' as const }
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
const buttonGreen = {
  ...button,
  backgroundColor: '#16a34a',
}
const link = { color: '#0099cc', textDecoration: 'underline' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '0 0 4px', fontWeight: '600' as const }
const footerLink = { fontSize: '13px', color: '#6b7280', margin: '0' }
