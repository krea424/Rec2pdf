export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export default classNames;
