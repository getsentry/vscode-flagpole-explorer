export function appendToMap<K = unknown, V = unknown, M extends Map<K, Set<V>> = Map<K, Set<V>>>(
  map: M,
  key: K,
  value: V
): void {
  if (!map.has(key)) {
    map.set(key, new Set<V>());
  }
  map.get(key)?.add(value);
}
