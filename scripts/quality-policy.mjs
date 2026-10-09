export function findNewDebt(current, accepted) {
  for (const ledger of [current, accepted]) {
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) throw new Error('Invalid lint debt ledger.');
    if (Object.values(ledger).some(count => !Number.isSafeInteger(count) || count <= 0)) throw new Error('Invalid lint debt count.');
  }
  return Object.entries(current).filter(([key, count]) => count > (Object.hasOwn(accepted, key) ? accepted[key] : 0));
}
