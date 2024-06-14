// module.exports = function (source) {
//     // Regular expression to match createClient(import.meta.resolve(<module_path>))
//     const regex = /createClient\s*\(\s*import\.meta\.resolve\s*\(\s*(['"`].*?['"`])\s*\)\s*\)/g;

//     // Replace with require(<module_path>)
//     return source.replace(regex, 'require($1)');
// };

const path = require('path');

module.exports = function (source) {
    // console.log(source)
    return source.replace(/createClient\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (match, p1) => {
        // console.log("P1", p1)
        // console.log("this.context" ,this.context)
        __dirname = this.context;
        // console.log("eval", eval(p1))
        // console.log("__dirname", __dirname)
        const filePath = path.resolve(this.context, eval(p1));
        return `require('${filePath}')`;
    });
};