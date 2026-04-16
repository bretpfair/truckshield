import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Link, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface QuotesReadyUrgencyProps {
  firstName?: string
  companyName?: string
  portalLink?: string
}

const QuotesReadyUrgencyEmail = ({ firstName, companyName, portalLink }: QuotesReadyUrgencyProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Quotes are ready for {companyName || 'your company'} — log in to compare</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME}</Heading>
        <Hr style={divider} />

        <Text style={text}>
          Hi {firstName || 'there'},
        </Text>

        <Text style={text}>
          <strong>Good news — quotes are ready for {companyName || 'your company'}!</strong>
        </Text>

        <Text style={text}>
          We've secured competitive options from top carriers for your fleet.
        </Text>

        <Text style={text}>
          Log in now to compare premiums and coverage details.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={portalLink || '#'}>
            View Your Quotes →
          </Button>
        </Section>

        <Text style={text}>
          These quotes expire soon — let's get you protected.
        </Text>

        <Text style={text}>
          Best regards,<br />
          The 360 Risk Partners Team
        </Text>

        <Hr style={divider} />

        <Text style={footer}>
          {SITE_NAME}
        </Text>
        <Text style={footerContact}>
          <Link href="mailto:Info@360riskpartners.com" style={footerLink}>Info@360riskpartners.com</Link>
          {' '} | {' '}
          <Link href="tel:8888854144" style={footerLink}>888-885-4144</Link>
        </Text>
        <Text style={footerLinkText}>
          <Link href="https://www.360riskpartners.com" style={footerLink}>www.360riskpartners.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: QuotesReadyUrgencyEmail,
  subject: (data: Record<string, any>) =>
    `Quotes Ready for ${data.companyName || 'Your Company'} — Compare Now`,
  displayName: 'Quotes ready with urgency',
  previewData: {
    firstName: 'John',
    companyName: 'Acme Trucking LLC',
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
const footer = { fontSize: '13px', color: '#6b7280', margin: '0 0 4px', fontWeight: '600' as const }
const footerContact = { fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }
const footerLink = { color: '#0099cc', textDecoration: 'none' }
const footerLinkText = { fontSize: '13px', color: '#6b7280', margin: '0' }
