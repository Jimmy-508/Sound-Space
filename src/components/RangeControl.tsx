interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  ariaValueText?: string;
  gestureControlId?: string;
  gestureSelected?: boolean;
  onChange: (value: number) => void;
}

export function RangeControl({ label, value, min, max, step, display, ariaValueText, gestureControlId, gestureSelected = false, onChange }: RangeControlProps) {
  return (
    <label
      className={`control ${gestureSelected ? 'gesture-control-selected' : ''}`}
      data-gesture-control-id={gestureControlId}
      data-gesture-clickable={gestureControlId ? 'true' : undefined}
    >
      <span>
        {label}
        <strong>{display}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} ${display}`}
        aria-valuetext={ariaValueText ?? display}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      {gestureSelected && <em className="gesture-control-marker">已選取</em>}
    </label>
  );
}
