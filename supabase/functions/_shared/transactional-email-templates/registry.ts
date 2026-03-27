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

export const TEMPLATES: Record<string, TemplateEntry> = {
  'client-portal-invite': clientPortalInvite,
  'additional-info-request': additionalInfoRequest,
  'carrier-status-change': carrierStatusChange,
}
