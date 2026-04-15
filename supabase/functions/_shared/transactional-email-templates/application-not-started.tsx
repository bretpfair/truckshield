import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Link, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface ApplicationNotStartedProps {
  firstName?: string
  companyName?: string
  portalLink?: string
}

const ApplicationNotStartedEmail = ({ firstName, companyName, portalLink }: ApplicationNotStartedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your trucking insurance application for {companyName || 'your company'} is waiting — get started today</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME}</Heading>
        <Hr style={divider} />

        <Text style={text}>
          Hi {firstName || 'there'},
        </Text>

        <Text style={text}>
          We set up your account{companyName ? ` for ${companyName}` : ''}, but it looks like you haven't started your trucking insurance application yet.
        </Text>

        <Text style={textBold}>
          Getting started only takes a few minutes. The sooner we have your information, the faster we can shop carriers and find you the best coverage at the best price.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={portalLink || '#'}>
            Start Your Application
          </Button>
        </Section>

        <Text style={text}>
          If you have any questions or need help, email us at{' '}
          <Link href="mailto:Info@360riskpartners.com" style={link}>Info@360riskpartners.com</Link>
          {' '}or call us at{' '}
          <Link href="tel:9166722440" style={link}>916-672-2440</Link>.
        </Text>

        <Hr style={divider} />

        <Text style={footer}>
          {SITE_NAME}
        </Text>
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

export const template = {
  component: ApplicationNotStartedEmail,
  subject: 'Your Insurance Application is Waiting — 360 Risk Partners',
  displayName: 'Application not started',
  previewData: {
    firstName: 'John',
    companyName: 'ABC Trucking LLC',
    portalLink: 'https://truckshield.360riskpartners.com/client',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0a1628', margin: '0 0 8px', letterSpacing: '-0.5px' }
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const textBold = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px', fontWeight: '600' as const }
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
