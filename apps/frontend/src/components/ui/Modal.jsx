'use client';

import * as React from "react";
import {
  Dialog, DialogPortal, DialogOverlay, DialogContent,
  DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose,
} from "./Dialog";
import { cn } from "@/lib/utils";

const Modal = ({ open, onClose, children, className, ...props }) => (
  <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
    <DialogPortal>
      <DialogOverlay />
      <DialogContent className={cn("max-w-lg", className)} {...props}>
        {children}
      </DialogContent>
    </DialogPortal>
  </Dialog>
);

const ModalHeader = DialogHeader;
const ModalBody = ({ className, ...props }) => (
  <div className={cn("py-2", className)} {...props} />
);
const ModalFooter = DialogFooter;
const ModalTitle = DialogTitle;
const ModalDescription = DialogDescription;
const ModalClose = DialogClose;

export { Modal, ModalHeader, ModalBody, ModalFooter, ModalTitle, ModalDescription, ModalClose };
