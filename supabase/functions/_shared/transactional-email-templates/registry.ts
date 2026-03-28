/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as clientPortalInvite } from './client-portal-invite.tsx'
import { template as additionalInfoRequest } from './additional-info-request.tsx'
import { template as carrierStatusChange } from './carrier-status-change.tsx'
import { template as applicationReminder } from './application-reminder.tsx'
import { template as infoRequestReminder } from './info-request-reminder.tsx'
import { template as applicationReceived } from './application-received.tsx'
import { template as pipelineStatusChange } from './pipeline-status-change.tsx'
import { template as newMessageReceived } from './new-message-received.tsx'
import { template as applicationCompletedStaff } from './application-completed-staff.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'client-portal-invite': clientPortalInvite,
  'additional-info-request': additionalInfoRequest,
  'carrier-status-change': carrierStatusChange,
  'application-reminder': applicationReminder,
  'info-request-reminder': infoRequestReminder,
  'application-received': applicationReceived,
  'pipeline-status-change': pipelineStatusChange,
  'new-message-received': newMessageReceived,
  'application-completed-staff': applicationCompletedStaff,
}
