'use client';

import React from 'react';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Right Side Split Modal (Side Sheet)
 * - Slides in from right to left
 * - Primary panel (right, 75%): main content, scrollable
 * - Secondary panel (left, 25%): visual support / branding (e.g. map placeholder)
 * - Desktop/Tablet: 75/25 split; Mobile: primary full width, secondary hidden
 * - Dismiss: close button, Escape, optional click on secondary panel
 */
export function RightSplitModal({
  open,
  onOpenChange,
  primaryChildren,
  secondaryChildren,
  dismissOnSecondaryClick = true,
  overlayClassName,
  title = 'Dialog',
}) {
  const handleSecondaryClick = () => {
    if (dismissOnSecondaryClick) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay
          className={cn(
            'fixed inset-0 z-40',
            'bg-black/40 backdrop-blur-sm md:backdrop-blur-md md:bg-black/25',
            open ? 'overlay-enter' : 'overlay-exit',
            overlayClassName
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 'auto',
            width: 'clamp(300px, 92vw, 1400px)',
            height: '100vh',
            display: 'flex',
            flexDirection: 'row',
            pointerEvents: open ? 'auto' : 'none',
          }}
          className={cn(
            'z-50 shadow-2xl focus:outline-none',
            open ? 'modal-enter' : 'modal-exit'
          )}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>

          {/* Secondary Panel (Left – 25%) – visual support, optional dismiss */}
          <div
            onClick={handleSecondaryClick}
            className={cn(
              'hidden md:flex w-1/4 min-w-0 flex-shrink-0',
              'cursor-default',
              dismissOnSecondaryClick && 'cursor-pointer'
            )}
            aria-hidden
          >
            {secondaryChildren ?? (
              <div
                className="h-full w-full flex flex-col items-center justify-between p-6 text-white overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #0A2D55 0%, #0C3B6E 50%, #0A2D55 100%)',
                }}
              >
                {/* Philippines Map Image */}
                <img 
                  src="/PH map.png" 
                  alt="Philippines Map" 
                  className="w-full h-auto max-w-xs flex-1 object-contain drop-shadow-lg"
                />

                <div className="text-center">
                  <p className="text-sm font-semibold text-white/95">
                    Philippines
                  </p>
                  <p className="text-xs text-white/70 mt-1">
                    Indigenous Cultural Communities
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Primary Panel (Right – 75%) – main content, scrollable */}
          <div className="flex w-full md:w-3/4 flex-col min-w-0 bg-white rounded-l-2xl md:rounded-l-2xl overflow-hidden">
            <div className="relative flex flex-1 flex-col overflow-hidden">
              <DialogPrimitive.Close
                className={cn(
                  'absolute top-4 right-4 z-10 rounded-lg p-2 text-[#0A2D55]',
                  'opacity-80 hover:opacity-100 hover:bg-[#0A2D55]/10',
                  'transition-opacity focus:ring-2 focus:ring-[#F2C94C]/50 focus:ring-offset-2 focus:outline-none'
                )}
                aria-label="Close"
              >
                <XIcon className="h-5 w-5" />
              </DialogPrimitive.Close>
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar">
                <div className="w-full h-full flex-1 flex flex-col min-h-0 px-3 py-3 sm:px-4 sm:py-4">
                  {primaryChildren}
                </div>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
