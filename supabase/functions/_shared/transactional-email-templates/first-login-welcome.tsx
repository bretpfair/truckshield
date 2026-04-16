import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Link, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface FirstLoginWelcomeProps {
  firstName?: string
  portalLink?: string
}

const FirstLoginWelcomeEmail = ({ firstName, portalLink }: FirstLoginWelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to your TruckShield Client Portal!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME}</Heading>
        <Hr style={divider} />

        <Text style={text}>
          Hi {firstName || 'there'},
        </Text>

        <Text style={text}>
          Welcome to your <strong>TruckShield Client Portal</strong>! 🎉
        </Text>

        <Text style={text}>
          You've taken the first step toward faster, easier trucking insurance.
        </Text>

        <Text style={text}>
          Inside you can:
        </Text>

        <Section style={listSection}>
          <Text style={listItem}>• Finish your application and get quoted quickly</Text>
          <Text style={listItem}>• Upload documents securely</Text>
          <Text style={listItem}>• Track quotes and policy status in real time</Text>
          <Text style={listItem}>• Message our team anytime</Text>
        </Section>

        <Text style={text}>
          We're thrilled to have you here.
        </Text>

        <Section style={buttonSection}>
          <Button style={button} href={portalLink || '#'}>
            Explore Your Portal →
          </Button>
        </Section>

        <Text style={text}>
          Best regards,<br />
          The 360 Risk Partners Team
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
  component: FirstLoginWelcomeEmail,
  subject: 'Welcome to Your TruckShield Client Portal! 🎉',
  displayName: 'First login welcome',
  previewData: {
    firstName: 'John',
    portalLink: 'https://truckshield.360riskpartners.com/client',
  },
} satisfies TemplateEntry

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
