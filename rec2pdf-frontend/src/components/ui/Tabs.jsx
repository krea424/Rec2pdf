import { createContext, useContext, useMemo, useState } from "react";
import { classNames } from "../../utils/classNames";

const TabsContext = createContext(null);

export function Tabs({ value, defaultValue, onValueChange, children }) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;

  const contextValue = useMemo(
    () => ({
      value: currentValue,
      setValue: (next) => {
        setInternalValue(next);
        onValueChange?.(next);
      },
    }),
    [currentValue, onValueChange]
  );

  return <TabsContext.Provider value={contextValue}>{children}</TabsContext.Provider>;
}

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error("Tabs components must be used within <Tabs />");
  }
  return ctx;
}

export function TabsList({ className, children }) {
  return (
    <div
      className={classNames(
        "inline-flex items-center gap-1 rounded-2xl border border-surface-700 bg-surface-900/80 p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className, children, disabled }) {
  const { value: activeValue, setValue } = useTabsContext();
  const isActive = value === activeValue;

  return (
    <button
      type="button"
      onClick={() => !disabled && setValue(value)}
      disabled={disabled}
      className={classNames(
        "min-w-[80px] rounded-xl px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
        isActive
          ? "bg-brand-500 text-white shadow-subtle"
          : "text-surface-200 hover:bg-surface-800/70",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children }) {
  const { value: activeValue } = useTabsContext();
  if (activeValue !== value) {
    return null;
  }
  return <div className={classNames("mt-4", className)}>{children}</div>;
}

export default Tabs;
