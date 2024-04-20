"use strict";
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, "__esModule", { value: true });
exports.Supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const retry_1 = __importDefault(require("retry"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
class Supabase {
    SUPABASE_URL;
    SUPABASE_API_KEY;
    constructor(SUPABASE_URL, SUPABASE_API_KEY) {
        this.SUPABASE_URL = SUPABASE_URL || process.env.SUPABASE_URL;
        this.SUPABASE_API_KEY = SUPABASE_API_KEY || process.env.SUPABASE_API_KEY;
    }
    // Function to create a Supabase client
    createClient() {
        return (0, supabase_js_1.createClient)(this.SUPABASE_URL, this.SUPABASE_API_KEY);
    }
    /**
     * Insert data into a vector database using a Supabase client.
     * @param client The Supabase client instance.
     * @param relation The name of the relation (table) to insert data into.
     * @param content The content to insert.
     * @param embedding The embedding data to insert.
     * @returns The inserted data if successful.
     * @throws Error if insertion fails.
     */
    async insertVectorData({ client, tableName, ...args }) {
        return new Promise((resolve, reject) => {
            const operation = retry_1.default.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });
            operation.attempt(async (currentAttempt) => {
                try {
                    const res = await client.from(tableName).insert(args);
                    if (res.error?.message) {
                        if (operation.retry(new Error())) {
                            return;
                        }
                        reject(
                            new Error(
                                `Failed to insert ${JSON.stringify(args)} with error message "${res.error.message}"`
                            )
                        );
                    } else {
                        resolve(res);
                    }
                } catch (error) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error);
                }
            });
        });
    }
    /**
     * fetch data from vector database using a Supabase client
     * @param client  - The Supabase client instance.
     * @param functionNameToCall - The function name that you want to run from sql queries
     * @param args - args that you define you query function
     * @returns The fetched data if successful.
     * @throws Error if fetching fails.
     */
    async getDataFromQuery({ client, functionNameToCall, ...args }) {
        return new Promise((resolve, reject) => {
            const operation = retry_1.default.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });
            operation.attempt(async (currentAttempt) => {
                try {
                    let res = await client.rpc(functionNameToCall, args);
                    console.log(res);
                    if (res.status == 200) {
                        resolve(res.data);
                    } else {
                        if (operation.retry(new Error())) return;
                        reject(
                            new Error(
                                `Failed with ErrorCode:${res.statusText} and ErrorMessage:${res.data}`
                            )
                        );
                    }
                } catch (error) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }
    /**
     * fetch all data from you database
     * @param client  - The Supabase client instance.
     * @param tableName - The tableName from you want to get your data
     * @returns The fetched data if successful.
     * @throws Error if fetching fails.
     */
    async getData({ client, tableName, columns }) {
        return new Promise((resolve, reject) => {
            const operation = retry_1.default.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });
            operation.attempt(async (currentAttempt) => {
                try {
                    // Insert data into the specified relation
                    const { data, error } = await client.from(tableName).select(columns || "*");
                    if (data) {
                        resolve(data);
                    }
                    if (operation.retry(new Error())) return;
                    reject(error);
                } catch (error) {
                    if (operation.retry(new Error())) return;
                    reject(error);
                }
            });
        });
    }
    /**
     * fetch data by id from you database
     * @param client  - The Supabase client instance.
     * @param tableName - The tableName from you want to get your data
     * @param id - The Id of row
     * @returns The fetched data if successful.
     * @throws Error if fetching fails.
     */
    async getDataById({ client, tableName, id }) {
        try {
            // Insert data into the specified relation
            const { data, error } = await client.from(tableName).select().eq("id", id).single();
            if (data) {
                return data;
            }
            return error;
        } catch (error) {
            console.error("Error inserting data into vector database:", error);
            throw error;
        }
    }
    /**
     * Update data by id
     * @param client  - The Supabase client instance.
     * @param tableName - The tableName from you want to update
     * @param id - The Id of row
     * @returns Updated data if Success
     * @throws Error if fetching fails.
     */
    async updateById({ client, tableName, id, updatedContent }) {
        try {
            // Insert data into the specified relation
            const { data, error } = await client
                .from(tableName)
                .update(updatedContent)
                .eq("id", id)
                .select()
                .single();
            if (data) {
                return data;
            }
            return error;
        } catch (error) {
            console.error("Error inserting data into vector database:", error);
            throw error;
        }
    }
    /**
     * Delete data by id
     * @param client  - The Supabase client instance.
     * @param tableName - The tableName from you want to update
     * @param id - The Id of row
     * @returns  Success
     * @throws Error if deleting is fails.
     */
    async deleteById({ client, tableName, id }) {
        try {
            // Insert data into the specified relation
            const res = await client.from(tableName).delete().eq("id", id);
            return { status: res.status, messages: res.statusText };
        } catch (error) {
            console.error("Error inserting data into vector database:", error);
            throw error;
        }
    }
}
exports.Supabase = Supabase;
