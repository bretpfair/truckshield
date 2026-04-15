import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Button, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface ApplicationCompletedStaffProps {
  companyName?: string
  dotNumber?: string
  submittedBy?: string
  portalLink?: string
}

const ApplicationCompletedStaffEmail = ({
  companyName,
  dotNumber,
  submittedBy,
  portalLink,
}: ApplicationCompletedStaffProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New completed application: {companyName || 'Unknown'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME}</Heading>
        <Hr style={divider} />

        <Heading as="h2" style={h2}>Application Completed — {companyName || 'Unknown'}</Heading>

        <Text style={text}>
          A new application has been submitted for <strong>{companyName || 'Unknown'}</strong> (DOT #{dotNumber || 'N/A'}).
        </Text>

        <Text style={text}>
          Submitted by: {submittedBy || 'Unknown'}
        </Text>

        {portalLink && (
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button style={button} href={portalLink}>
              View Full Application →
            </Button>
          </Section>
        )}

        <Text style={text}>
          Please review and begin carrier outreach.
        </Text>

        <Text style={text}>
          360 Risk Partners Team
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
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ApplicationCompletedStaffEmail,
  subject: (data: Record<string, any>) =>
    `Application completed — ${data?.companyName || 'New Account'}`,
  displayName: 'Application completed (staff notification)',
  previewData: {
    companyName: 'Acme Trucking LLC',
    dotNumber: '1234567',
    submittedBy: 'John Smith',
    portalLink: 'https://truckshield.360riskpartners.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0a1628', margin: '0 0 8px', letterSpacing: '-0.5px' }
const h2 = { fontSize: '20px', fontWeight: '600' as const, color: '#0a1628', margin: '0 0 16px' }
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#0099cc',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  display: 'inline-block' as const,
}
const footer = { fontSize: '13px', color: '#6b7280', margin: '0 0 4px', fontWeight: '600' as const }
const footerContact = { fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }
const footerLink = { color: '#0099cc', textDecoration: 'none' }