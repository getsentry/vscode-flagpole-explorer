export default function sortMapByKeys<M extends Map<unknown, unknown>>(map: M): M {
  return new Map([...map.entries()].sort()) as M;
}
