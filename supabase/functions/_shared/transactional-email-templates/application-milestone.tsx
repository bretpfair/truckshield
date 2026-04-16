import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Link, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface ApplicationMilestoneProps {
  firstName?: string
  companyName?: string
  completionPercentage?: string
  portalLink?: string
}

const ApplicationMilestoneEmail = ({ firstName, companyName, completionPercentage, portalLink }: ApplicationMilestoneProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Great progress — your application is {completionPercentage || '50'}% complete!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME}</Heading>
        <Hr style={divider} />

        <Text style={text}>
          Hi {firstName || 'there'},
        </Text>

        <Text style={text}>
          <strong>Great progress!</strong> Your application for <strong>{companyName || 'your company'}</strong> is now <strong>{completionPercentage || '50'}% complete</strong>.
        </Text>

        <Text style={text}>
          You're well on your way to getting competitive quotes from top carriers.
        </Text>

        <Text style={text}>
          Keep going — every section you finish brings us closer to protecting your fleet.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={portalLink || '#'}>
            Continue Your Application →
          </Button>
        </Section>

        <Text style={text}>
          You've got this!
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
  component: ApplicationMilestoneEmail,
  subject: (data: Record<string, any>) =>
    `Application ${data.completionPercentage || '50'}% Complete — Keep Going!`,
  displayName: 'Application milestone celebration',
  previewData: {
    firstName: 'John',
    companyName: 'Acme Trucking LLC',
    completionPercentage: '50',
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
