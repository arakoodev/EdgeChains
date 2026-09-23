module.exports = {
    presets: [["@babel/preset-env", { targets: { node: "current" } }], "@babel/preset-typescript"],
    testEnvironment: "jest-environment-jsdom",
    // resolve node export conditions so packages like the AWS SDK ship their CJS/Node builds
    testEnvironmentOptions: {
        customExportConditions: ["node", "node-addons"],
    },
    // let tests import TypeScript sources using NodeNext-style "./x.js" specifiers
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    transform: {
        "^.+\\.ts?$": "ts-jest",
        "^.+\\.tsx?$": "ts-jest",
        "^.+\\.js?$": "babel-jest",
        "^.+\\.jsx?$": "babel-jest",
    },
};
