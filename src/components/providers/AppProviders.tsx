'use client';

import React, { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { SettingsProvider } from '@/lib/settings';
import { I18nProvider } from '@/lib/i18n';
import { ModalProvider } from '@/lib/modal-service';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <I18nProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </I18nProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
