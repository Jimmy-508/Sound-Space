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
      data-gesture-selected={gestureSelected ? 'true' : undefined}
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
        aria-label={`${label} ${display}${gestureSelected ? '，手勢已鎖定' : ''}`}
        aria-valuetext={ariaValueText ?? display}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      {gestureSelected && <i className="gesture-control-marker" aria-hidden="true" />}
    </label>
  );
}
