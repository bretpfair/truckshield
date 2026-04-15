import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface ApplicationReceivedProps {
  companyName?: string
  firstName?: string
}

const ApplicationReceivedEmail = ({ companyName, firstName }: ApplicationReceivedProps) => (
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
          Great news — we've received your completed application
          {companyName ? ` for ${companyName}` : ''}.
        </Text>

        <Text style={text}>
          Our team will begin reviewing your information and working to find the most
          competitive insurance solution available for your operation. Here's what happens next:
        </Text>

        <Section style={listSection}>
          <Text style={listItem}>✓ &nbsp;We review your application details</Text>
          <Text style={listItem}>✓ &nbsp;We submit to our carrier partners on your behalf</Text>
          <Text style={listItem}>✓ &nbsp;We present you with the most competitive options</Text>
        </Section>

        <Text style={text}>
          If we need any additional information, we'll reach out through your client portal
          or via email. In the meantime, feel free to log in to your portal at any time to
          check on the status of your account.
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
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0a1628', margin: '0 0 8px', letterSpacing: '-0.5px' }
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const listSection = { margin: '0 0 16px', paddingLeft: '8px' }
const listItem = { fontSize: '14px', color: '#374151', lineHeight: '1.5', margin: '0 0 6px', paddingLeft: '4px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '0 0 4px', fontWeight: '600' as const }
const footerContact = { fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }
const footerLink = { color: '#0099cc', textDecoration: 'none' }
const footerNote = { fontSize: '13px', color: '#6b7280', margin: '0' }
