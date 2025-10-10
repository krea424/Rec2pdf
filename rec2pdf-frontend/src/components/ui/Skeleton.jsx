import { classNames } from "../../utils/classNames";

export function Skeleton({ className }) {
  return (
    <div
      className={classNames(
        "animate-pulse rounded-xl bg-surface-800/70",
        className
      )}
    />
  );
}

export default Skeleton;
