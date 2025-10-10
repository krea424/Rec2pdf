import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { classNames } from "../../utils/classNames";

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 disabled:cursor-not-allowed disabled:opacity-60";

const variantStyles = {
  primary:
    "bg-brand-500 text-white shadow-raised hover:bg-brand-400 focus-visible:ring-brand-200",
  secondary:
    "bg-surface-800 text-surface-25 shadow-subtle hover:bg-surface-700",
  outline:
    "border border-surface-600 bg-transparent text-surface-50 hover:border-brand-400 hover:text-white",
  ghost:
    "bg-transparent text-surface-200 hover:bg-surface-800/60",
  subtle:
    "bg-surface-900/60 text-surface-100 border border-surface-700 hover:bg-surface-800/60",
  danger:
    "bg-feedback-danger text-white shadow-raised hover:bg-red-500",
};

const sizeStyles = {
  xs: "h-8 px-3 text-xs",
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const iconOnlySizes = {
  xs: "h-8 w-8",
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-12 w-12",
};

export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    isLoading = false,
    leadingIcon: LeadingIcon,
    trailingIcon: TrailingIcon,
    iconOnly = false,
    href,
    className,
    children,
    ...props
  },
  ref
) {
  const resolvedVariant = variantStyles[variant] || variantStyles.primary;
  const resolvedSize = iconOnly
    ? iconOnlySizes[size] || iconOnlySizes.md
    : sizeStyles[size] || sizeStyles.md;

  const content = (
    <span className="inline-flex items-center gap-2">
      {isLoading && (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {!isLoading && LeadingIcon ? (
        <LeadingIcon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {iconOnly ? children : <span className="truncate">{children}</span>}
      {!isLoading && TrailingIcon ? (
        <TrailingIcon className="h-4 w-4" aria-hidden="true" />
      ) : null}
    </span>
  );

  if (href) {
    const { disabled, onClick, ...rest } = props;
    return (
      <a
        ref={ref}
        href={disabled || isLoading ? undefined : href}
        onClick={(event) => {
          if (disabled || isLoading) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
        aria-disabled={disabled || isLoading}
        className={classNames(
          baseStyles,
          resolvedVariant,
          resolvedSize,
          "no-underline",
          disabled || isLoading ? "pointer-events-none" : null,
          className
        )}
        {...rest}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      className={classNames(baseStyles, resolvedVariant, resolvedSize, className)}
      disabled={props.disabled || isLoading}
      {...props}
    >
      {content}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton(
  { variant = "ghost", size = "sm", className, children, ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      iconOnly
      className={classNames(iconOnlySizes[size] || iconOnlySizes.sm, "p-0", className)}
      {...props}
    >
      {children}
    </Button>
  );
});

export default Button;
