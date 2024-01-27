export function jsonnet(filename: string): Promise<string>;

/**
 * useage:
 * const extVars = JSON.stringify({
 *  a: 1,
 *  b: 2,
 *  });
 *  await jsonnetExtVars(filename, extVars);
 */
export function jsonnetExtVars(filename: string, extVars: string): Promise<string>;
