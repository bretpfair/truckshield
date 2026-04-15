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

        <Heading as="h2" style={h2}>Application Completed</Heading>

        <Text style={text}>
          A client has submitted their completed application and it's ready for review.
        </Text>

        <Section style={detailsSection}>
          <Text style={detailRow}>
            <span style={detailLabel}>Company:</span>{' '}
            <span style={detailValue}>{companyName || 'N/A'}</span>
          </Text>
          {dotNumber && (
            <Text style={detailRow}>
              <span style={detailLabel}>DOT #:</span>{' '}
              <span style={detailValue}>{dotNumber}</span>
            </Text>
          )}
          {submittedBy && (
            <Text style={detailRow}>
              <span style={detailLabel}>Submitted by:</span>{' '}
              <span style={detailValue}>{submittedBy}</span>
            </Text>
          )}
        </Section>

        <Text style={text}>
          The account status has been updated to <strong>Info Complete</strong>. 
          You can now begin the quoting process.
        </Text>

        {portalLink && (
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button style={button} href={portalLink}>
              View Account
            </Button>
          </Section>
        )}

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
const detailsSection = { backgroundColor: '#f8fafc', borderRadius: '8px', padding: '16px 20px', margin: '0 0 20px' }
const detailRow = { fontSize: '14px', color: '#374151', lineHeight: '1.5', margin: '0 0 6px' }
const detailLabel = { fontWeight: '600' as const, color: '#6b7280' }
const detailValue = { color: '#111827' }
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
