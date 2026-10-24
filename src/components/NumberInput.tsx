import { useEffect, useState } from "react";
import type { InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max" | "step"
> & {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
};

/** A text draft permits clearing/retyping a field without clamping each keystroke. */
export function NumberInput({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  ...props
}: Props) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() {
    const parsed = draft.trim() === "" ? value : Number(draft);
    const clamped = Math.max(
      min,
      Math.min(max, Number.isFinite(parsed) ? parsed : value),
    );
    const rounded = Math.round(clamped / step) * step;
    const next = Number(rounded.toFixed(3));
    setDraft(String(next));
    onValueChange(next);
  }
  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = Number(text);
        if (
          text !== "" &&
          Number.isFinite(parsed) &&
          parsed >= min &&
          parsed <= max &&
          (step !== 1 || Number.isInteger(parsed))
        )
          onValueChange(parsed);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
