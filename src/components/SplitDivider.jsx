import { useRef } from 'react';

const KEY_STEP = 16;

// Vertical drag handle between two panes: a 1px rule inside a 16px hit area.
// `value` is the left pane's width; `onChange` receives the requested width
// and is responsible for clamping it.
export default function SplitDivider({ value, min, max, onChange, label, controls }) {
  const drag = useRef(null);

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startValue: value };
  };

  const onPointerMove = (event) => {
    if (!drag.current) return;
    onChange(drag.current.startValue + event.clientX - drag.current.startX);
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (event) => {
    const next = {
      ArrowLeft: value - KEY_STEP,
      ArrowRight: value + KEY_STEP,
      Home: min,
      End: max,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      className="split-divider"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <span className="split-divider-handle" aria-hidden="true">
        <span className="split-divider-grip" />
      </span>
    </div>
  );
}
