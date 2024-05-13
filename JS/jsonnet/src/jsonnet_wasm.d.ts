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
/**
* @param {number} vm
* @param {string} filename
* @returns {string}
*/
export function jsonnet_evaluate_file(vm: number, filename: string): string;
/**
* @param {number} vm
* @param {string} key
* @param {string} value
*/
export function ext_string(vm: number, key: string, value: string): void;
/**
* @param {string} name
* @returns {Function | undefined}
*/
export function get_func(name: string): Function | undefined;
/**
* @param {string} name
* @param {Function} func
*/
export function set_func(name: string, func: Function): void;
/**
* @param {number} vm
* @param {string} name
* @param {number} args_num
*/
export function register_native_callback(vm: number, name: string, args_num: number): void;
