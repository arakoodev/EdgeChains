import * as fs from "fs";
import * as path from "path";

function copyFile(source: string, destination: string) {
  const sourcePath = path.resolve(source);
  const destinationPath = path.resolve(destination);

  const readStream = fs.createReadStream(sourcePath);
  const writeStream = fs.createWriteStream(destinationPath);

  readStream.on("error", (err: any) => {
    console.log(err);
  });

  writeStream.on("error", (err: any) => {
    console.log(err);
  });

  writeStream.on("finish", () => {
    console.log("success");
  });

  readStream.pipe(writeStream);
}

export { copyFile };
