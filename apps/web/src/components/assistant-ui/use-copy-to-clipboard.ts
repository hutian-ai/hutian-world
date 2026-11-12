"use client";

import { useState } from "react";

export type UseCopyToClipboardOptions = {
  copiedDuration?: number;
};

export const useCopyToClipboard = ({ copiedDuration = 3000 }: UseCopyToClipboardOptions = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<boolean>(false);

  const markCopied = () => {
    setCopyError(false);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), copiedDuration);
  };

  const fallbackCopy = (value: string): boolean => {
    if (typeof document === "undefined") return false;
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    activeElement?.focus();
    return copied;
  };

  const copyToClipboard = (value: string) => {
    if (!value) return;
    setCopyError(false);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      let settled = false;
      const fallback = () => {
        if (settled) return;
        settled = true;
        if (fallbackCopy(value)) markCopied();
        else setCopyError(true);
      };
      const fallbackTimer = window.setTimeout(fallback, 250);
      navigator.clipboard.writeText(value).then(() => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fallbackTimer);
        markCopied();
      }, fallback);
      return;
    }
    if (fallbackCopy(value)) markCopied();
    else setCopyError(true);
  };

  return { isCopied, copyError, copyToClipboard };
};
