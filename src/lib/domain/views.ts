import type { DoseWithMedication } from '@/lib/db/types';
import { doseOutcome, minutesLate, type DoseOutcome } from '@/lib/domain/doses';
import { formatTime } from '@/lib/time/format';

export type DoseView = {
  id: string;
  timeLabel: string;
  outcome: DoseOutcome;
  minutesLate: number;
  medication: string;
  detail: string;
  instructions: string | null;
  accent: string;
  personName: string;
  personId: string;
};

export function toDoseView(dose: DoseWithMedication, timezone: string, now = new Date()): DoseView {
  return {
    id: dose.id,
    timeLabel: formatTime(dose.due_at, timezone),
    outcome: doseOutcome(dose, now),
    minutesLate: minutesLate(dose),
    medication: dose.medications.name,
    detail: [dose.medications.strength, dose.medications.form].filter(Boolean).join(' ') || 'Scheduled dose',
    instructions: dose.medications.instructions,
    accent: dose.medications.accent,
    personName: dose.profiles.full_name,
    personId: dose.profiles.id,
  };
}
