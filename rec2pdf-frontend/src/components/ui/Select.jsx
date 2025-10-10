import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { classNames } from "../../utils/classNames";

const wrapperStyles =
  "relative flex w-full items-center rounded-xl border border-surface-700 bg-surface-900/70 px-3 text-sm text-surface-50 shadow-inset focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-300";

export const Select = forwardRef(function Select(
  { label, helperText, error, className, containerClassName, children, ...props },
  ref
) {
  return (
    <label className={classNames("flex w-full flex-col gap-1 text-sm", containerClassName)}>
      {label && <span className="font-medium text-surface-200">{label}</span>}
      <div
        className={classNames(
          wrapperStyles,
          error && "border-feedback-danger/70 text-feedback-danger focus-within:ring-feedback-danger"
        )}
      >
        <select
          ref={ref}
          className={classNames(
            "w-full appearance-none bg-transparent py-2 pr-8 text-sm outline-none",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none h-4 w-4 text-surface-400" aria-hidden="true" />
      </div>
      {helperText && !error ? (
        <span className="text-xs text-surface-300">{helperText}</span>
      ) : null}
      {error ? <span className="text-xs text-feedback-danger">{error}</span> : null}
    </label>
  );
});

export default Select;
