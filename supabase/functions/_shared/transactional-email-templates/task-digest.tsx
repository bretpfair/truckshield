import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Link, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = '360 Risk Partners'

interface TaskItem {
  title: string
  accountName: string
  dueDate?: string
  priority: string
}

interface TaskDigestProps {
  firstName?: string
  overdueTasks?: TaskItem[]
  dueTodayTasks?: TaskItem[]
  portalLink?: string
}

const priorityBadge = (priority: string) => {
  const colors: Record<string, { bg: string; text: string }> = {
    high: { bg: '#fef2f2', text: '#dc2626' },
    medium: { bg: '#fffbeb', text: '#d97706' },
    low: { bg: '#f0fdf4', text: '#16a34a' },
  }
  const c = colors[priority] || colors.medium
  return (
    <span style={{ backgroundColor: c.bg, color: c.text, fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', marginLeft: '8px', textTransform: 'uppercase' as const }}>
      {priority}
    </span>
  )
}

const TaskRow = ({ task }: { task: TaskItem }) => (
  <div style={taskRow}>
    <Text style={taskTitle}>
      {task.title}{priorityBadge(task.priority)}
    </Text>
    <Text style={taskMeta}>
      {task.accountName}{task.dueDate ? ` · Due: ${task.dueDate}` : ''}
    </Text>
  </div>
)

const TaskDigestEmail = ({ firstName, overdueTasks = [], dueTodayTasks = [], portalLink }: TaskDigestProps) => {
  const totalTasks = overdueTasks.length + dueTodayTasks.length
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You have {totalTasks} task{totalTasks !== 1 ? 's' : ''} that need attention</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{SITE_NAME}</Heading>
          <Hr style={divider} />

          <Text style={text}>
            Hi {firstName || 'there'},
          </Text>

          <Text style={text}>
            Here's your daily task summary:
          </Text>

          {overdueTasks.length > 0 && (
            <Section>
              <Heading as="h2" style={sectionHeading}>
                🔴 Overdue ({overdueTasks.length})
              </Heading>
              {overdueTasks.map((task, i) => (
                <TaskRow key={i} task={task} />
              ))}
            </Section>
          )}

          {dueTodayTasks.length > 0 && (
            <Section style={{ marginTop: '16px' }}>
              <Heading as="h2" style={sectionHeading}>
                🟡 Due Today ({dueTodayTasks.length})
              </Heading>
              {dueTodayTasks.map((task, i) => (
                <TaskRow key={i} task={task} />
              ))}
            </Section>
          )}

          <Section style={buttonSection}>
            <Button style={button} href={portalLink || '#'}>
              View Tasks in TruckShield
            </Button>
          </Section>

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
}

export const template = {
  component: TaskDigestEmail,
  subject: (data: Record<string, any>) => {
    const total = (data.overdueTasks?.length || 0) + (data.dueTodayTasks?.length || 0)
    return `Daily Task Summary — ${total} task${total !== 1 ? 's' : ''} need attention`
  },
  displayName: 'Daily task digest',
  previewData: {
    firstName: 'Mike',
    overdueTasks: [
      { title: 'Follow up on loss runs', accountName: 'ABC Trucking', dueDate: 'Apr 5', priority: 'high' },
      { title: 'Request driver MVRs', accountName: 'XYZ Logistics', dueDate: 'Apr 7', priority: 'medium' },
    ],
    dueTodayTasks: [
      { title: 'Submit to Great West', accountName: 'ABC Trucking', dueDate: 'Apr 9', priority: 'high' },
    ],
    portalLink: 'https://truckshield.lovable.app',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#0a1628', margin: '0 0 8px', letterSpacing: '-0.5px' }
const divider = { borderColor: '#e2e8f0', margin: '20px 0' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const sectionHeading = { fontSize: '16px', fontWeight: '600' as const, color: '#0a1628', margin: '0 0 12px' }
const taskRow = { borderLeft: '3px solid #e2e8f0', paddingLeft: '12px', marginBottom: '12px' }
const taskTitle = { fontSize: '14px', fontWeight: '600' as const, color: '#1f2937', margin: '0 0 2px', lineHeight: '1.4' }
const taskMeta = { fontSize: '13px', color: '#6b7280', margin: '0', lineHeight: '1.4' }
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
