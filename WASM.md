---

# Compilation to webassembly for edge devices
## Setup

 1. Select latest successful workflow run from [here](https://github.com/arakoodev/EdgeChains/actions/workflows/release-wasm.yml) .
 2. Then scroll to bottom and download artifact . A zip will be downloaded to your system 
 3. Extract the zip . 
 4. You will have two binaries `arakoo` *(this is runtime)* and `arakoo-compiler` *(this is our extended javy compiler)*
 5. Copy these two binaries to `~/.local/bin` or `/usr/bin` *(if you want all users to access the binaries )*
 6. Open terminal and grant executable permission to copied binaries by running `chmod +x "<path of copied arakoo-compiler>"` and `chmod +x "<path of copied arakoo>"`

 *You are now good to go ! Have look at below  section which describe how you can create apis in hono and compile them to wasm*
 
 ## Compiling js to wasm
1. Open Terminal
2. Create a new directory `helloworld` by running 
 ```mkdir helloworld && cd helloworld```  
3. Initialize it 
```npm init -y```
4. Add `"type":"module"` in package.json to use es6 syntax.
5. Install hono `npm install hono@^3.9` (as of now only this hono version is supported)
6. Create a `index.js` file and open it with your favourite editor.
7. Paste below code in it
```js
import {Hono} from  "hono";
const  app = new  Hono();

app.get("/hello", async (c)=>{
	return  c.json({message :  "hello world"})
})

app.fire();
```
8.  Now since javy doesn't have capability to require or import module . So we will bundle the index.js with esbuild.
9. To do so , install esbuild as developer dependency 
```
npm install esbuild --save-dev
```  
10. Create a build file `build.js`
11. Paste below code in it
```js
import {build} from  "esbuild";

build({
	entryPoints: ["index.js"], // specify input file ( in this case this the index.js file we created earlier)
	bundle:  true, // this allows esbuild to find all dependencies and bundle them together in one file
	outfile:  "dist.js", // the name of the output bundle file you desire ( in this case we named it dist.js
	platform:"node",
}).catch((error)=>{
	console.log("Error ",error);
	process.exit(1);
})
```
12. Now compile bundled file with javy 
```
arakoo-compiler dist.js 
```
13. You should see a new file `index.wasm` in the directory

## Executing wasm
You can execute the compiled wasm with installed `arakoo` runtime.
To do so simple run 
```
arakoo index.wasm
``` 
You should see output as -

![image](https://github.com/redoC-A2k/EdgeChains/assets/60838316/75bab29e-de61-4f1b-87ea-66b921441a66)

Send get request to http://localhost:8080/hello to test the api.
You should get response as shown below \-

![image](https://github.com/redoC-A2k/EdgeChains/assets/60838316/6796513d-63e3-4ce4-a797-ffd20ac0b7a1)

---
