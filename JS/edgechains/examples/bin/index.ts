import * as path from "node:path";
import * as fs from "node:fs";
import inquirer from "inquirer";
import { format } from "prettier";
import { get_ts_config } from "./src/get-tsconfig.js";
import { get_package_json } from "./src/get-package-json.js";
import { get_gitignore } from "./src/get-gitignore.js";
import { get_env } from "./src/get-env.js";
import { get_eslintignore } from "./src/get-eslint-ignore.js";
import { copyFolderRecursive } from "./src/utils/copyFolderRecursively.js";
import { fileURLToPath } from "node:url";
import { copyFile } from "./src/utils/copyFile.js";

type Options = {
    project_name: string;
    lang_preference: "typescript" | "javascript";
    deployment_target: "node"|"deno";
  };

const lang_choices = ["TypeScript", "JavaScript"] as const;

const deployment_choices = [
    "Node",
    "Deno",
  ] as const;

function dirname_from_import_meta(import_meta_url: string) {
  return path.dirname(fileURLToPath(import_meta_url));
}

type Prompts = Parameters<(typeof inquirer)["prompt"]>[0];

const prompts = [
    {
      type: "",
      name: "new_dir_name",
      message: `Enter a name for your project's new directory:`,
      prefix: "\n",
      validate: (dirname: string) => {
        const invalidCharacters = /[<>:"\/\\|?*\x00-\x1F ]/;
        return !!dirname && !invalidCharacters.test(dirname);
      },
    },
    {
      type: "list",
      name: "lang_preference",
      message: "TypeScript or JavaScript?",
      choices: lang_choices,
      prefix: "\n",
    },
    {
      type: "list",
      name: "deployment_target",
      message: `Choose a deployment target (easy to change later):`,
      choices: deployment_choices,
      prefix: "\n",
    },
  ] satisfies Prompts;

  async function ask_questions(): Promise<
  | {
      new_dir_name: string;
      lang_preference: (typeof lang_choices)[number];
      deployment_target: (typeof deployment_choices)[number];
    }
  | undefined
> {
  try {
    return await inquirer.prompt(prompts);
  } catch (error) {
    console.error("\nError:", error);
  }
}

function get_options(
  choices: NonNullable<Awaited<ReturnType<typeof ask_questions>>>,
) {
  return {
    project_name: choices.new_dir_name,
    lang_preference:
      choices.lang_preference === "TypeScript" ? "typescript" : "javascript",
    deployment_target:
        choices.deployment_target === "Deno"
        ? "deno"
        : "node",
  } satisfies Options;
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

    const dir_already_exists =
      fs.existsSync(new_dir_path) && fs.statSync(new_dir_path).isDirectory();

    if (dir_already_exists) {
      throw new Error(`Directory ${new_dir_path} already exists.`);
    }

    // create all the folders we need
    fs.mkdirSync(new_dir_path, { recursive: true });
    fs.mkdirSync(path.join(new_dir_path, "src"), { recursive: true });
    fs.mkdirSync(path.join(new_dir_path, "src/config"), { recursive: true });
    fs.mkdirSync(path.join(new_dir_path, "src/jsonnet"), { recursive: true });
    fs.mkdirSync(path.join(new_dir_path, "src/lib"), { recursive: true });
    fs.mkdirSync(path.join(new_dir_path, "src/routes"), { recursive: true });
    fs.mkdirSync(path.join(new_dir_path, "src/service"), { recursive: true });
    fs.mkdirSync(path.join(new_dir_path, "src/types"), { recursive: true });

    // tsconfig
    fs.writeFileSync(
      path.join(new_dir_path, "tsconfig.json"),
      await format(get_ts_config(), {
        parser: "json",
      }),
      "utf8",
    );

    // package.json
    fs.writeFileSync(
      path.join(new_dir_path, "package.json"),
      await format(get_package_json(), {
        parser: "json",
      }),
      "utf8",
    );

    // gitignore
    fs.writeFileSync(
      path.join(new_dir_path, ".gitignore"),
      get_gitignore(),
      "utf8",
    );

    // .env
    fs.writeFileSync(
      path.join(new_dir_path, ".env"),
      get_env(),
      "utf8",
    );

    // eslintignore
    fs.writeFileSync(
      path.join(new_dir_path, ".eslintignore"),
      get_eslintignore(),
      "utf8",
    );

    const root_dir_path = path.join(
      dirname_from_import_meta(import.meta.url),
      `../`,
    );

    // config folder
    const configSourceFolder = path.join(root_dir_path, '../examples/src/config');
    
    const configDestinationFolder = path.join(new_dir_path, 'src/config');

    await copyFolderRecursive(configSourceFolder, configDestinationFolder);

    // jsonnet folder
    const jsonnetSourceFolder = path.join(root_dir_path, '../examples/src/jsonnet');
    
    const jsonnetDestinationFolder = path.join(new_dir_path, 'src/jsonnet');

    await copyFolderRecursive(jsonnetSourceFolder, jsonnetDestinationFolder);
    
    // lib folder
    const libSourceFolder = path.join(root_dir_path, '../examples/src/lib');
    
    const libDestinationFolder = path.join(new_dir_path, 'src/lib');

    await copyFolderRecursive(libSourceFolder, libDestinationFolder);

    // routes folder

    const routesSourceFolder = path.join(root_dir_path, '../examples/src/routes');
    
    const routesDestinationFolder = path.join(new_dir_path, 'src/routes');

    await copyFolderRecursive(routesSourceFolder, routesDestinationFolder);

    // service folder 

    const serviceSourceFolder = path.join(root_dir_path, '../examples/src/service');
    
    const serviceDestinationFolder = path.join(new_dir_path, 'src/service');

    await copyFolderRecursive(serviceSourceFolder, serviceDestinationFolder);

    // types folder

    const typesSourceFolder = path.join(root_dir_path, '../examples/src/types');
    
    const typesDestinationFolder = path.join(new_dir_path, 'src/types');

    await copyFolderRecursive(typesSourceFolder, typesDestinationFolder);

    // .eslint.js

    const eslintJsSource = path.join(root_dir_path, '../examples/.eslintrc.js');
    
    const eslintJsDestination = path.join(new_dir_path, '.eslintrc.js');

    await copyFile(eslintJsSource, eslintJsDestination);

    // .eslint.js

    const prettierJsSource = path.join(root_dir_path, '../examples/.prettierrrc.json');
    
    const prettierJsDestination = path.join(new_dir_path, '.prettierrrc.json');
    
    await copyFile(prettierJsSource, prettierJsDestination);

    // esbuild.build.js

    const buildJsSource = path.join(root_dir_path, '../examples/esbuild.build.js');
    
    const buildJsDestination = path.join(new_dir_path, 'esbuild.build.js');
        
    await copyFile(buildJsSource, buildJsDestination);

    // orm config

    const ormConfigJsSource = path.join(root_dir_path, '../examples/ormconfig.json');
    
    const ormConfigJsDestination = path.join(new_dir_path, 'ormconfig.json');
        
    await copyFile(ormConfigJsSource, ormConfigJsDestination);

    // index.ts

    const indexTsSource = path.join(root_dir_path, '../examples/src/index.ts');
    
    const indexTsDestination = path.join(new_dir_path, 'src/index.ts');
            
    await copyFile(indexTsSource, indexTsDestination);

    // setupTests.ts

    const setupTestsTsSource = path.join(root_dir_path, '../examples/src/setupTests.ts');
    
    const setupTestsTsDestination = path.join(new_dir_path, 'src/setupTests.ts');
            
    await copyFile(setupTestsTsSource, setupTestsTsDestination);

    

  } catch (e) {
    return e;
  }
  
}

await main();

export type { Options };