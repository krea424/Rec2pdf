import { classNames } from "../../utils/classNames";

const toneStyles = {
  info: "border border-feedback-info/30 bg-feedback-info/15 text-feedback-info",
  success: "border border-feedback-success/30 bg-feedback-success/15 text-feedback-success",
  warning: "border border-feedback-warning/30 bg-feedback-warning/15 text-feedback-warning",
  danger: "border border-feedback-danger/30 bg-feedback-danger/15 text-feedback-danger",
};

export function Toast({ tone = "info", title, description, className, action }) {
  return (
    <div
      className={classNames(
        "flex flex-col gap-1 rounded-2xl px-4 py-3 text-sm shadow-subtle",
        toneStyles[tone] || toneStyles.info,
        className
      )}
      role="status"
    >
      {title && <span className="font-semibold text-base">{title}</span>}
      {description && <span className="text-sm">{description}</span>}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export default Toast;
