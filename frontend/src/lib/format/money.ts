const kshFormatter = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
});

export function formatKsh(value: number) {
  return `KSh ${kshFormatter.format(value)}`;
}

export function formatCost(value: number) {
  return `$${value.toFixed(4)}`;
}
