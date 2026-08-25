'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';

export type ModalType = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ModalType;
}

interface NotifyOptions {
  title?: string;
  message: string;
  type?: ModalType;
  duration?: number;
}

interface ModalContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  notify: (options: NotifyOptions | string) => void;
}

const ModalContext = createContext<ModalContextType>({
  confirm: async () => false,
  notify: () => {},
});

export function ModalProvider({ children }: { children: ReactNode }) {
  // Confirm State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  // Toast / Notify State
  const [toast, setToast] = useState<{
    id: number;
    title?: string;
    message: string;
    type: ModalType;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts: ConfirmOptions =
      typeof options === 'string'
        ? { message: options, title: 'Confirmation requise', type: 'danger' }
        : {
            title: options.title || (options.type === 'danger' ? 'Confirmation de suppression' : 'Confirmation'),
            message: options.message,
            confirmText: options.confirmText || (options.type === 'danger' ? 'Supprimer' : 'Confirmer'),
            cancelText: options.cancelText || 'Annuler',
            type: options.type || 'danger',
          };

    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options: opts,
        resolve,
      });
    });
  }, []);

  const notify = useCallback((options: NotifyOptions | string) => {
    const opts: NotifyOptions =
      typeof options === 'string'
        ? { message: options, type: 'info' }
        : {
            title: options.title,
            message: options.message,
            type: options.type || 'info',
            duration: options.duration || 4000,
          };

    const id = Date.now();
    setToast({
      id,
      title: opts.title,
      message: opts.message,
      type: opts.type || 'info',
    });

    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, opts.duration || 4000);
  }, []);

  const handleClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  const getIcon = (type?: ModalType) => {
    switch (type) {
      case 'danger':
        return <Trash2 className="w-6 h-6 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      case 'info':
      default:
        return <Info className="w-6 h-6 text-sky-500" />;
    }
  };

  const getIconContainerStyle = (type?: ModalType) => {
    switch (type) {
      case 'danger':
        return 'bg-rose-500/15 ring-8 ring-rose-500/10 text-rose-500 border border-rose-500/20';
      case 'warning':
        return 'bg-amber-500/15 ring-8 ring-amber-500/10 text-amber-500 border border-amber-500/20';
      case 'success':
        return 'bg-emerald-500/15 ring-8 ring-emerald-500/10 text-emerald-500 border border-emerald-500/20';
      case 'info':
      default:
        return 'bg-sky-500/15 ring-8 ring-sky-500/10 text-sky-500 border border-sky-500/20';
    }
  };

  const getConfirmButtonStyle = (type?: ModalType) => {
    switch (type) {
      case 'danger':
        return 'bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-500/30';
      case 'warning':
        return 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/30';
      case 'success':
        return 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30';
      case 'info':
      default:
        return 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/30';
    }
  };

  return (
    <ModalContext.Provider value={{ confirm, notify }}>
      {children}

      {/* Centered Styled Modal Widget */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop Blur with GM dark tint */}
          <div
            onClick={() => handleClose(false)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
          />

          {/* Centered Modal Card */}
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md bg-white dark:bg-[#0B1324] rounded-3xl border border-slate-200 dark:border-sky-500/20 shadow-2xl shadow-black/60 p-6 sm:p-7 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Top decorative gradient line */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                confirmState.options.type === 'danger'
                  ? 'bg-gradient-to-r from-rose-500 via-red-500 to-orange-500'
                  : confirmState.options.type === 'warning'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                  : 'bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600'
              }`}
            />

            {/* School identity watermark / header badge */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white p-0.5 ring-2 ring-sky-400/40 shadow-sm flex items-center justify-center">
                  <Image
                    src="/logo.png"
                    alt="GM School"
                    width={26}
                    height={26}
                    className="object-contain"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-tight text-slate-800 dark:text-white block leading-tight">
                    GÉNÉRATIONS MONTANTES
                  </span>
                  <span className="text-[9px] text-sky-500 font-semibold block">Système de Sécurité & Validation</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleClose(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex flex-col items-center text-center my-2">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform ${getIconContainerStyle(
                  confirmState.options.type
                )}`}
              >
                {getIcon(confirmState.options.type)}
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                {confirmState.options.title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed">
                {confirmState.options.message}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
              >
                {confirmState.options.cancelText || 'Annuler'}
              </button>

              <button
                type="button"
                onClick={() => handleClose(true)}
                autoFocus
                className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all transform active:scale-95 cursor-pointer ${getConfirmButtonStyle(
                  confirmState.options.type
                )}`}
              >
                {confirmState.options.confirmText || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Center / Top Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
          <div
            className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-start gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-white'
                : toast.type === 'danger'
                ? 'bg-rose-950/90 border-rose-500/40 text-white'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/40 text-white'
                : 'bg-slate-900/90 border-sky-500/40 text-white'
            }`}
          >
            <div className="shrink-0 mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 min-w-0">
              {toast.title && <div className="text-xs font-bold uppercase tracking-wider">{toast.title}</div>}
              <div className="text-xs text-slate-200 mt-0.5">{toast.message}</div>
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useConfirm() {
  const { confirm } = useContext(ModalContext);
  return confirm;
}

export function useNotify() {
  const { notify } = useContext(ModalContext);
  return notify;
}
