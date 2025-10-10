import { classNames } from "../../utils/classNames";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <div
      className={classNames(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-surface-700/80 bg-surface-900/40 px-6 py-12 text-center text-surface-200",
        className
      )}
    >
      {Icon ? <Icon className="h-10 w-10 text-brand-400" aria-hidden="true" /> : null}
      {title && <h3 className="text-lg font-semibold text-surface-50">{title}</h3>}
      {description && <p className="max-w-md text-sm text-surface-300">{description}</p>}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
