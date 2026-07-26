import { Badge, type Tone } from "@/components/ui";
import { STATUS_LABELS, type LeaveStatus } from "@/lib/types";

const TONES: Record<LeaveStatus, Tone> = {
  pending: "warning",
  approved: "positive",
  rejected: "negative",
  cancelled: "neutral",
};

export default function StatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
