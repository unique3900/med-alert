'use client';

import { useActionState, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { saveMedication, type ActionState } from '@/app/actions/medications';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field';
import { ACCENT_OPTIONS, AccentDot, Panel, PanelHeader } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const INTERVALS = [
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 180, label: 'Every 3 hours' },
  { value: 240, label: 'Every 4 hours' },
  { value: 360, label: 'Every 6 hours' },
  { value: 480, label: 'Every 8 hours' },
  { value: 720, label: 'Every 12 hours' },
];

export type MedicationFormValues = {
  id?: string;
  profileId: string;
  name: string;
  strength: string;
  form: string;
  instructions: string;
  accent: string;
  isActive: boolean;
  kind: 'fixed' | 'interval';
  times: string[];
  intervalMinutes: number;
  windowStart: string;
  windowEnd: string;
  daysOfWeek: number[];
  startsOn: string;
  endsOn: string;
};

export function MedicationForm({
  values,
  people,
  canReassign,
}: {
  values: MedicationFormValues;
  people: { id: string; full_name: string }[];
  canReassign: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveMedication, {});

  const [kind, setKind] = useState(values.kind);
  const [times, setTimes] = useState<string[]>(values.times);
  const [draftTime, setDraftTime] = useState('08:00');
  const [accent, setAccent] = useState(values.accent);
  const [days, setDays] = useState<number[]>(values.daysOfWeek);

  function addTime() {
    if (!draftTime || times.includes(draftTime)) return;
    setTimes([...times, draftTime].sort());
  }

  function toggleDay(day: number) {
    setDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()));
  }

  return (
    <form action={formAction} className="space-y-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="times" value={times.join(',')} />
      <input type="hidden" name="accent" value={accent} />
      {days.map((day) => (
        <input key={day} type="hidden" name="daysOfWeek" value={day} />
      ))}

      <Panel className="space-y-5 p-5">
        <PanelHeader title="Medication" description="What is taken, and by whom." />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={values.name} required placeholder="Paracetamol" />
          </Field>

          <Field label="Strength" htmlFor="strength">
            <Input id="strength" name="strength" defaultValue={values.strength} placeholder="500 mg" />
          </Field>

          <Field label="Form" htmlFor="form">
            <Input id="form" name="form" defaultValue={values.form} placeholder="Tablet" />
          </Field>

          <Field label="For" htmlFor="profileId">
            <Select id="profileId" name="profileId" defaultValue={values.profileId} disabled={!canReassign} required>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Colour">
            <div className="flex h-11 items-center gap-2">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAccent(option)}
                  aria-label={option}
                  aria-pressed={accent === option}
                  className={cn(
                    'grid size-8 place-items-center rounded-full border-2 transition-colors',
                    accent === option ? 'border-accent' : 'border-transparent',
                  )}
                >
                  <AccentDot accent={option} className="size-4" />
                </button>
              ))}
            </div>
          </Field>

          <Field label="Instructions" htmlFor="instructions" className="sm:col-span-2">
            <Textarea
              id="instructions"
              name="instructions"
              defaultValue={values.instructions}
              placeholder="After food, with a full glass of water."
            />
          </Field>
        </div>
      </Panel>

      <Panel className="space-y-5 p-5">
        <PanelHeader title="Schedule" description="When the alarm should ring." />

        <div className="grid grid-cols-2 gap-2">
          {(['fixed', 'interval'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={cn(
                'rounded-xl border p-3.5 text-left transition-colors',
                kind === option ? 'border-accent bg-accent-soft' : 'border-line bg-panel-soft',
              )}
            >
              <span className="block text-sm font-medium">{option === 'fixed' ? 'Set times' : 'Repeat'}</span>
              <span className="block text-xs text-ink-muted">
                {option === 'fixed' ? '08:00, 20:30 …' : 'Every few hours'}
              </span>
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />

        {kind === 'fixed' ? (
          <div className="space-y-3">
            <Field label="Times of day">
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={draftTime}
                  onChange={(event) => setDraftTime(event.target.value)}
                  aria-label="New dose time"
                />
                <Button type="button" variant="secondary" onClick={addTime} className="shrink-0">
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
            </Field>

            <div className="flex flex-wrap gap-2">
              {times.length === 0 ? (
                <p className="text-sm text-ink-muted">No times yet — add at least one.</p>
              ) : (
                times.map((time) => (
                  <span
                    key={time}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-1.5 pr-1.5 pl-3 font-mono text-sm text-accent tabular-nums"
                  >
                    {time}
                    <button
                      type="button"
                      onClick={() => setTimes(times.filter((value) => value !== time))}
                      aria-label={`Remove ${time}`}
                      className="rounded-full p-0.5 hover:bg-accent/20"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="How often" htmlFor="intervalMinutes">
              <Select id="intervalMinutes" name="intervalMinutes" defaultValue={values.intervalMinutes}>
                {INTERVALS.map((interval) => (
                  <option key={interval.value} value={interval.value}>
                    {interval.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="From" htmlFor="windowStart">
              <Input id="windowStart" name="windowStart" type="time" defaultValue={values.windowStart} />
            </Field>

            <Field label="Until" htmlFor="windowEnd">
              <Input id="windowEnd" name="windowEnd" type="time" defaultValue={values.windowEnd} />
            </Field>
          </div>
        )}

        {kind === 'fixed' ? (
          <>
            <input type="hidden" name="windowStart" value={values.windowStart} />
            <input type="hidden" name="windowEnd" value={values.windowEnd} />
          </>
        ) : null}

        <Field label="Days">
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((label, day) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={days.includes(day)}
                className={cn(
                  'h-10 w-12 rounded-xl border text-xs font-medium transition-colors',
                  days.includes(day)
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-panel-soft text-ink-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="startsOn">
            <Input id="startsOn" name="startsOn" type="date" defaultValue={values.startsOn} required />
          </Field>
          <Field label="Ends" htmlFor="endsOn" hint="Leave empty for an ongoing course.">
            <Input id="endsOn" name="endsOn" type="date" defaultValue={values.endsOn} />
          </Field>
        </div>

        <label className="flex items-center gap-3 rounded-xl bg-panel-soft px-3.5 py-3">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={values.isActive}
            className="size-4 accent-[var(--accent)]"
          />
          <span className="text-sm">Active — send alarms for this medication</span>
        </label>
      </Panel>

      <FormError>{state.error}</FormError>

      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Saving…' : 'Save medication'}
        </Button>
      </div>
    </form>
  );
}
