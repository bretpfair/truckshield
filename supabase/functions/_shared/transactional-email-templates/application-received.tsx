import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Link, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface ApplicationReceivedProps {
  companyName?: string
  firstName?: string
  portalLink?: string
}

const ApplicationReceivedEmail = ({ companyName, firstName, portalLink }: ApplicationReceivedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Application received — our team is on it</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME}</Heading>
        <Hr style={divider} />

        <Text style={text}>
          Hi {firstName || 'there'},
        </Text>

        <Text style={text}>
          Thank you! Your trucking insurance application for <strong>{companyName || 'your company'}</strong> has been successfully received.
        </Text>

        <Text style={text}>
          Our team is reviewing it now and will begin shopping the best carriers for your fleet. You'll receive updates as soon as quotes come in.
        </Text>

        <Text style={text}>
          In the meantime, you can log into your portal anytime to track progress or message us directly.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={portalLink || '#'}>
            View Your Portal
          </Button>
        </Section>

        <Text style={text}>
          Thank you for trusting 360 Risk Partners.
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
        <Text style={footerNote}>
          Thank you for trusting us with your trucking insurance needs.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ApplicationReceivedEmail,
  subject: 'Application received — our team is on it',
  displayName: 'Application received confirmation',
  previewData: {
    companyName: 'Acme Trucking LLC',
    firstName: 'John',
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
const footerNote = { fontSize: '13px', color: '#6b7280', margin: '0' }