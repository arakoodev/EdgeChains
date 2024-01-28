/* tslint:disable */
/* eslint-disable */
/**
* @returns {number}
*/
export function jsonnet_make(): number;
/**
* @param {number} vm
*/
export function jsonnet_destroy(vm: number): void;
/**
* @param {number} vm
* @param {string} filename
* @param {string} snippet
* @returns {string}
*/
export function jsonnet_evaluate_snippet(vm: number, filename: string, snippet: string): string;
