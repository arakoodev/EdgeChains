import * as path from "node:path";
import * as fs from "node:fs";
import inquirer from "inquirer";
import { format } from "prettier";
import { get_ts_config } from "./src/get-tsconfig.js";
import { get_package_json } from "./src/get-package-json.js";
import { fileURLToPath } from "node:url";
import { get_gitignore } from "./src/get-gitignore.js";
import { get_env } from "./src/get-env.js";
function dirname_from_import_meta(import_meta_url) {
    return path.dirname(fileURLToPath(import_meta_url));
}
const prompts = [
    {
        type: "number",
        name: "new_dir_name",
        message: `Enter a name for your project's new directory:`,
        prefix: "\n",
        validate: (dirname) => {
            const invalidCharacters = /[<>:"\/\\|?*\x00-\x1F ]/;
            return !!dirname && !invalidCharacters.test(dirname);
        },
    },
];
async function ask_questions() {
    try {
        return await inquirer.prompt(prompts);
    }
    catch (error) {
        console.error("\nError:", error);
    }
}
function get_options(choices) {
    const options = {
        project_name: choices.new_dir_name,
        lang_preference: "typescript",
        deployment_target: "node",
    };
    return options;
}
async function main() {
    const choices = await ask_questions();
    if (!choices) {
        console.log("\nSomething went wrong! Please file an issue.\n");
        return;
    }
    const options = get_options(choices);
    console.log("\nWorking...");
    try {
        const new_dir_path = path.join(process.cwd(), choices.new_dir_name);
        const dir_already_exists = fs.existsSync(new_dir_path) && fs.statSync(new_dir_path).isDirectory();
        if (dir_already_exists) {
            throw new Error(`Directory ${new_dir_path} already exists.`);
        }
        function handle_file_copy({ code, destination_without_extension, extension, }) {
            return handle_file_copy_low_level({
                code,
                destination_without_extension,
                new_dir_path,
                extension,
            });
        }
        // create all the folders we need
        fs.mkdirSync(new_dir_path, { recursive: true });
        fs.mkdirSync(path.join(new_dir_path, "src"), { recursive: true });
        fs.mkdirSync(path.join(new_dir_path, "src/jsonnet"), { recursive: true });
        fs.mkdirSync(path.join(new_dir_path, "src/routes"), { recursive: true });
        fs.mkdirSync(path.join(new_dir_path, "src/service"), { recursive: true });
        fs.mkdirSync(path.join(new_dir_path, "src/types"), { recursive: true });
        fs.mkdirSync(path.join(new_dir_path, "src/layouts"), { recursive: true });
        fs.mkdirSync(path.join(new_dir_path, "src/testGeneration"), { recursive: true });
        // tsconfig
        fs.writeFileSync(path.join(new_dir_path, "tsconfig.json"), await format(get_ts_config(), {
            parser: "json",
        }), "utf8");
        // package.json
        fs.writeFileSync(path.join(new_dir_path, "package.json"), await format(get_package_json(options), {
            parser: "json",
        }), "utf8");
        //gitignore
        fs.writeFileSync(path.join(new_dir_path, ".gitignore"), get_gitignore(), "utf8");
        //.env
        fs.writeFileSync(path.join(new_dir_path, ".env"), get_env(), "utf8");
        const root_dir_path = path.join(dirname_from_import_meta(import.meta.url), `../`);
        const layout_file = "ExampleLayout";
        handle_file_copy({
            code: fs.readFileSync(path.join(root_dir_path, "__common/src/layouts/" + layout_file + ".ts"), "utf8"),
            destination_without_extension: "src/layouts/" + layout_file,
            extension: ".ts",
        });
        const route_file = "hydeSearch.route";
        handle_file_copy({
            code: fs.readFileSync(path.join(root_dir_path, "__common/src/routes/" + route_file + ".ts"), "utf8"),
            destination_without_extension: "src/routes/" + route_file,
            extension: ".ts",
        });
        const service_files = ["HydeSearchService", "HydeSearchService.test"];
        await Promise.all(service_files.map(async (file) => {
            return handle_file_copy({
                code: fs.readFileSync(path.join(root_dir_path, "__common/src/service/" + file + ".ts"), "utf8"),
                destination_without_extension: "src/service/" + file,
                extension: ".ts",
            });
        }));
        const type_file = "HydeFragmentData";
        handle_file_copy({
            code: fs.readFileSync(path.join(root_dir_path, "__common/src/types/" + type_file + ".ts"), "utf8"),
            destination_without_extension: "src/types/" + type_file,
            extension: ".ts",
        });
        const test_file = "TestGenerator";
        handle_file_copy({
            code: fs.readFileSync(path.join(root_dir_path, "__common/src/testGeneration/" + test_file + ".ts"), "utf8"),
            destination_without_extension: "src/testGeneration/" + test_file,
            extension: ".ts",
        });
        const index_file = "index";
        handle_file_copy({
            code: fs.readFileSync(path.join(root_dir_path, "__common/src/" + index_file + ".ts"), "utf8"),
            destination_without_extension: "src/" + index_file,
            extension: ".ts",
        });
        const jsonnet_files = ["hyde", "prompts"];
        await Promise.all(jsonnet_files.map(async (file) => {
            return handle_file_copy({
                code: fs.readFileSync(path.join(root_dir_path, "__common/src/jsonnet/" + file + ".jsonnet"), "utf8"),
                destination_without_extension: "src/jsonnet/" + file,
                extension: ".jsonnet",
            });
        }));
        await Promise.all(jsonnet_files.map(async (file) => {
            return handle_file_copy({
                code: fs.readFileSync(path.join(root_dir_path, "__common/src/jsonnet/" + file + ".jsonnet"), "utf8"),
                destination_without_extension: "src/testGeneration/" + file,
                extension: ".jsonnet",
            });
        }));
        const build_file = "esbuild.build";
        handle_file_copy({
            code: fs.readFileSync(path.join(root_dir_path, "__common/" + build_file + ".js"), "utf8"),
            destination_without_extension: "/" + build_file,
            extension: ".js",
        });
        const html_js_file = "htmljs";
        handle_file_copy({
            code: fs.readFileSync(path.join(root_dir_path, "__common/" + html_js_file + ".ts"), "utf8"),
            destination_without_extension: "/" + html_js_file,
            extension: ".ts",
        });
        const orm_file = "ormconfig";
        handle_file_copy({
            code: fs.readFileSync(path.join(root_dir_path, "__common/" + orm_file + ".json"), "utf8"),
            destination_without_extension: "/" + orm_file,
            extension: ".json",
        });
        console.log("\nFinished...");
    }
    catch (e) {
        return e;
    }
}
async function runMain() {
    await main();
}
runMain();
async function handle_file_copy_low_level({ code, destination_without_extension, new_dir_path, extension, }) {
    fs.writeFileSync(path.join(new_dir_path, destination_without_extension + extension), code, "utf8");
}
