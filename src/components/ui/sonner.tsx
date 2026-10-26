"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toasts styled as the prototype `.toast`: an ink pill at the bottom center (18px from
 * the bottom, 82px on mobile above the tabbar, as `.m-screen .toast`). Unstyled sonner
 * with the `lm-toast` class from globals.css.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      dir="rtl"
      position="bottom-center"
      offset={{ bottom: 18 }}
      mobileOffset={{ bottom: "calc(82px + env(safe-area-inset-bottom))" }}
      className="toaster group"
      toastOptions={{
        unstyled: true,
        classNames: { toast: "lm-toast" },
      }}
      {...props}
    />
  );
};

export { Toaster };
