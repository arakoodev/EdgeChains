import { SupabaseClient } from "@supabase/supabase-js";
interface ArgsObject {
    [key: string]: any;
}
interface InsertVectorDataArgs {
    client: SupabaseClient;
    tableName: string;
    [key: string]: any;
}
interface GetDataFromQueryArgs {
    client: SupabaseClient;
    functionNameToCall: string;
    [key: string]: any;
}
export declare class Supabase {
    SUPABASE_URL: string;
    SUPABASE_API_KEY: string;
    constructor(SUPABASE_URL: string, SUPABASE_API_KEY: string);
    createClient(): SupabaseClient<any, "public", any>;
    /**
  * Insert data into a vector database using a Supabase client.
  * @param client The Supabase client instance.
  * @param relation The name of the relation (table) to insert data into.
  * @param content The content to insert.
  * @param embedding The embedding data to insert.
  * @returns The inserted data if successful.
  * @throws Error if insertion fails.
  */
    insertVectorData({ client, tableName, ...args }: InsertVectorDataArgs): Promise<any>;
    /**
     * fetch data from vector database using a Supabase client
     * @param client  - The Supabase client instance.
     * @param functionNameToCall - The function name that you want to run from sql queries
     * @param args - args that you define you query function
     * @returns The fetched data if successful.
     * @throws Error if fetching fails.
     */
    getDataFromQuery({ client, functionNameToCall, ...args }: GetDataFromQueryArgs): Promise<any>;
    /**
     * fetch all data from you database
     * @param client  - The Supabase client instance.
     * @param tableName - The tableName from you want to get your data
     * @returns The fetched data if successful.
     * @throws Error if fetching fails.
     */
    getData({ client, tableName, columns }: {
        client: SupabaseClient;
        tableName: string;
        columns: string;
    }): Promise<any>;
    /**
     * fetch data by id from you database
     * @param client  - The Supabase client instance.
     * @param tableName - The tableName from you want to get your data
     * @param id - The Id of row
     * @returns The fetched data if successful.
     * @throws Error if fetching fails.
     */
    getDataById({ client, tableName, id }: {
        client: SupabaseClient;
        tableName: string;
        id: number;
    }): Promise<any>;
    /**
     * Update data by id
     * @param client  - The Supabase client instance.
     * @param tableName - The tableName from you want to update
     * @param id - The Id of row
     * @returns Updated data if Success
     * @throws Error if fetching fails.
     */
    updateById({ client, tableName, id, updatedContent }: {
        client: SupabaseClient;
        tableName: string;
        id: number;
        updatedContent: ArgsObject;
    }): Promise<any>;
    /**
     * Delete data by id
     * @param client  - The Supabase client instance.
     * @param tableName - The tableName from you want to update
     * @param id - The Id of row
     * @returns  Success
     * @throws Error if deleting is fails.
     */
    deleteById({ client, tableName, id }: {
        client: SupabaseClient;
        tableName: string;
        id: number;
    }): Promise<any>;
}
export {};
