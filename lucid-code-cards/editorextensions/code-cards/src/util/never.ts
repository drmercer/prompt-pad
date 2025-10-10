export function assertNever(x: never): never {
  console.error("Unexpected value:", x);
  throw new Error("Unexpected value: " + x);
}
