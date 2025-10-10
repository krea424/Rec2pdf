import { classNames } from "../../utils/classNames";

const toneStyles = {
  neutral: "bg-surface-800/70 text-surface-100 border border-surface-700",
  brand: "bg-brand-500/20 text-brand-200 border border-brand-400/40",
  success: "bg-feedback-success/15 text-feedback-success border border-feedback-success/30",
  danger: "bg-feedback-danger/15 text-feedback-danger border border-feedback-danger/30",
  warning: "bg-feedback-warning/20 text-feedback-warning border border-feedback-warning/40",
  info: "bg-feedback-info/20 text-feedback-info border border-feedback-info/40",
};

export function Badge({ tone = "neutral", className, children, icon: Icon }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        toneStyles[tone] || toneStyles.neutral,
        className
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
}

export default Badge;
