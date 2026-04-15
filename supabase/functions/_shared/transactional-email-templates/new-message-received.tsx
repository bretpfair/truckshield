import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Link, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface NewMessageReceivedProps {
  firstName?: string
  companyName?: string
  senderName?: string
  messagePreview?: string
  portalLink?: string
}

const NewMessageReceivedEmail = ({ firstName, companyName, senderName, messagePreview, portalLink }: NewMessageReceivedProps) => {
  const preview = messagePreview
    ? messagePreview.length > 120 ? messagePreview.slice(0, 120) + '…' : messagePreview
    : undefined

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{companyName ? `New message on ${companyName}` : 'You have a new message'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{SITE_NAME}</Heading>
          <Hr style={divider} />

          <Text style={text}>
            Hi {firstName || 'there'},
          </Text>

          <Text style={text}>
            You have a <strong>new message</strong> regarding <strong>{companyName || 'your account'}</strong> from your 360 Risk Partners team.
          </Text>

          <Text style={text}>
            <strong>Message preview:</strong>
          </Text>

          {preview && (
            <Section style={quoteSection}>
              <Text style={quoteText}>"{preview}"</Text>
            </Section>
          )}

          <Section style={buttonSection}>
            <Button style={button} href={portalLink || '#'}>
              View & Reply →
            </Button>
          </Section>

          <Text style={text}>
            We're here to help — reply anytime.
          </Text>

          <Text style={text}>
            Best regards,<br />
            The 360 Risk Partners Team
          </Text>

          <Hr style={divider} />

          <Text style={footer}>{SITE_NAME}</Text>
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
}

export const template = {
  component: NewMessageReceivedEmail,
  subject: (data: Record<string, any>) =>
    data?.companyName
      ? `New message — ${data.companyName}`
      : 'You have a new message',
  displayName: 'New message received',
  previewData: {
    firstName: 'John',
    companyName: 'ABC Trucking LLC',
    senderName: '360 Risk Partners',
    messagePreview: 'Hi John, just wanted to follow up on the quote we discussed earlier this week.',
    portalLink: 'https://truckshield.360riskpartners.com/client',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0a1628', margin: '0 0 8px', letterSpacing: '-0.5px' }
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const quoteSection = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', margin: '0 0 16px' }
const quoteText = { fontSize: '14px', color: '#374151', lineHeight: '1.5', margin: '0', fontStyle: 'italic' as const }
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