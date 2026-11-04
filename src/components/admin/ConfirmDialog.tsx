import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  secondaryAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  };
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "destructive",
  loading = false,
  onConfirm,
  secondaryAction,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-heading font-semibold text-foreground">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2">
          <AlertDialogCancel disabled={loading} className="mt-0">
            {cancelText}
          </AlertDialogCancel>
          {secondaryAction && (
            <button
              type="button"
              disabled={loading}
              onClick={async (e) => {
                e.preventDefault();
                await secondaryAction.onClick();
              }}
              className={cn(
                buttonVariants({ variant: secondaryAction.variant || "outline" }),
                "w-full sm:w-auto"
              )}
            >
              {secondaryAction.label}
            </button>
          )}
          <AlertDialogAction
            disabled={loading}
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
            }}
            className={cn(
              buttonVariants({ variant }),
              "w-full sm:w-auto",
              variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmDialog;

