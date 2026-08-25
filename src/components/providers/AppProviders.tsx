'use client';

import React, { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { SettingsProvider } from '@/lib/settings';
import { I18nProvider } from '@/lib/i18n';
import { ModalProvider } from '@/lib/modal-service';
import { PWAProvider } from '@/components/pwa/PWAProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <I18nProvider>
          <ModalProvider>
            <PWAProvider>
              {children}
            </PWAProvider>
          </ModalProvider>
        </I18nProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
