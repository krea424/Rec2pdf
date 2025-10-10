import { forwardRef } from "react";
import { classNames } from "../../utils/classNames";

const baseStyles =
  "block w-full rounded-xl border border-surface-700 bg-surface-900/70 px-3 py-2 text-sm text-surface-50 shadow-inset transition focus-visible:border-brand-400 focus-visible:ring-1 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = forwardRef(function Input(
  { label, helperText, error, prefix, suffix, className, containerClassName, ...props },
  ref
) {
  return (
    <label className={classNames("flex w-full flex-col gap-1 text-sm", containerClassName)}>
      {label && <span className="font-medium text-surface-200">{label}</span>}
      <div className="relative flex items-center">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-surface-400">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          className={classNames(
            baseStyles,
            prefix && "pl-9",
            suffix && "pr-9",
            error && "border-feedback-danger/70 text-feedback-danger focus-visible:ring-feedback-danger",
            className
          )}
          {...props}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-surface-400">
            {suffix}
          </span>
        ) : null}
      </div>
      {helperText && !error ? (
        <span className="text-xs text-surface-300">{helperText}</span>
      ) : null}
      {error ? <span className="text-xs text-feedback-danger">{error}</span> : null}
    </label>
  );
});

export const TextArea = forwardRef(function TextArea(
  { label, helperText, error, className, containerClassName, rows = 4, ...props },
  ref
) {
  return (
    <label className={classNames("flex w-full flex-col gap-1 text-sm", containerClassName)}>
      {label && <span className="font-medium text-surface-200">{label}</span>}
      <textarea
        ref={ref}
        rows={rows}
        className={classNames(
          "w-full rounded-xl border border-surface-700 bg-surface-900/70 px-3 py-2 text-sm text-surface-50 shadow-inset transition focus-visible:border-brand-400 focus-visible:ring-1 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60",
          error && "border-feedback-danger/70 text-feedback-danger focus-visible:ring-feedback-danger",
          className
        )}
        {...props}
      />
      {helperText && !error ? (
        <span className="text-xs text-surface-300">{helperText}</span>
      ) : null}
      {error ? <span className="text-xs text-feedback-danger">{error}</span> : null}
    </label>
  );
});

export default Input;
