"use strict";
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cors = void 0;
const cors_1 = __importDefault(require("cors"));
function Cors() {
    return cors_1.default;
}
exports.Cors = Cors;
