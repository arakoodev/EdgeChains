import * as fs from 'fs';
import * as path from 'path';

async function copyFolderRecursive(source: string, destination: string): Promise<void> {
    try {
        if (!fs.existsSync(source)) {
            console.error(`Source directory ${source} does not exist.`);
        } 
        // Read the contents of the source directory
        const files = fs.readdirSync(source);

        for (const file of files) {
            const sourcePath = path.join(source, file);
            const destinationPath = path.join(destination, file);

            // Check if the current item is a file or a directory
            const isDirectory = fs.statSync(sourcePath).isDirectory();

            if (isDirectory) {
                // Recursively copy the subdirectory
                await copyFolderRecursive(sourcePath, destinationPath);
            } else {
                // Copy the file
                fs.copyFileSync(sourcePath, destinationPath);
                console.log(`File ${sourcePath} copied to ${destinationPath}`);
            }
        }

        console.log(`Folder ${source} copied to ${destination}`);
    } catch (error) {
        console.error(`Error copying folder from ${source} to ${destination}: ${error}`);
    }
}

export { copyFolderRecursive };