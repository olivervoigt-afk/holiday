"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * Absenden mit Rückfrage. Wird für Aktionen verwendet, die sich nicht ohne
 * Weiteres rückgängig machen lassen.
 */
export default function ConfirmButton({
  children,
  question,
  variant = "danger",
  className,
}: {
  children: React.ReactNode;
  question: string;
  variant?: "danger" | "secondary" | "ghost" | "primary" | "positive";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (!confirm(question)) event.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
