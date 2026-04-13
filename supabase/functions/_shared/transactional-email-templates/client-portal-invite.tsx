import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Link, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface ClientPortalInviteProps {
  firstName?: string
  portalLink?: string
}

const ClientPortalInviteEmail = ({ firstName, portalLink }: ClientPortalInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your secure client portal is ready — complete your trucking insurance application</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME}</Heading>
        <Hr style={divider} />

        <Text style={text}>
          Hi {firstName || 'there'},
        </Text>

        <Text style={text}>
          Thanks for the opportunity to quote your trucking insurance.
        </Text>

        <Text style={text}>
          To keep things moving, we've set up a secure client portal for you. Inside the portal, you can:
        </Text>

        <Section style={listSection}>
          <Text style={listItem}>✓ Complete any missing underwriting details</Text>
          <Text style={listItem}>✓ Upload required documents</Text>
          <Text style={listItem}>✓ Review submission progress in real time</Text>
          <Text style={listItem}>✓ Track quote status as markets respond</Text>
        </Section>

        <Text style={text}>
          Getting this information completed quickly helps us approach more carriers and improve your pricing and options.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={portalLink || '#'}>
            Access Your Portal
          </Button>
        </Section>

        <Text style={text}>
          If you have questions or prefer to walk through it together, email us at{' '}
          <Link href="mailto:Info@360riskpartners.com" style={link}>Info@360riskpartners.com</Link>
          {' '}or call us directly at{' '}
          <Link href="tel:9166722440" style={link}>916-672-2440</Link>.
        </Text>

        <Text style={text}>
          We'll keep you updated as quotes come in or underwriters request additional info.
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
  component: ClientPortalInviteEmail,
  subject: 'Your Client Portal is Ready — 360 Risk Partners',
  displayName: 'Client portal invite',
  previewData: {
    firstName: 'John',
    portalLink: 'https://truckshield.360riskpartners.com/auth?invite=sample-token',
  },
} satisfies TemplateEntry

// Styles — brand: primary hsl(195, 100%, 50%) = #00bfff
const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0a1628', margin: '0 0 8px', letterSpacing: '-0.5px' }
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const listSection = { margin: '0 0 16px', paddingLeft: '8px' }
const listItem = { fontSize: '14px', color: '#374151', lineHeight: '1.5', margin: '0 0 6px', paddingLeft: '4px' }
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
