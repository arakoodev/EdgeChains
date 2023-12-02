"use strict";
var __decorate =
    (this && this.__decorate) ||
    function (decorators, target, key, desc) {
        var c = arguments.length,
            r =
                c < 3
                    ? target
                    : desc === null
                      ? (desc = Object.getOwnPropertyDescriptor(target, key))
                      : desc,
            d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
            r = Reflect.decorate(decorators, target, key, desc);
        else
            for (var i = decorators.length - 1; i >= 0; i--)
                if ((d = decorators[i]))
                    r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };
var __metadata =
    (this && this.__metadata) ||
    function (k, v) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
            return Reflect.metadata(k, v);
    };
var __param =
    (this && this.__param) ||
    function (paramIndex, decorator) {
        return function (target, key) {
            decorator(target, key, paramIndex);
        };
    };
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const hydeExample_1 = require("./hydeExample/hydeExample");
const TestGenerator_1 = require("./testGeneration/TestGenerator");
let AppController = class AppController {
    constructor(appService) {
        this.appService = appService;
    }
    getHello() {
        return this.appService.getHello();
    }
    hydeSearch(params, query) {
        const arkRequest = {
            topK: params.topK,
            metadataTable: query.metadataTable,
            query: query.query,
            textWeight: query.textWeight,
            similarityWeight: query.similarityWeight,
            dateWeight: query.dateWeight,
            orderRRF: query.orderRRF,
        };
        return (0, hydeExample_1.hydeSearchAdaEmbedding)(arkRequest);
    }
    testGenerator() {
        return (0, TestGenerator_1.getContent)();
    }
};
exports.AppController = AppController;
__decorate(
    [
        (0, common_1.Get)(),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", String),
    ],
    AppController.prototype,
    "getHello",
    null
);
__decorate(
    [
        (0, common_1.Post)("/hyde-search/query-rrf"),
        (0, common_1.HttpCode)(200),
        __param(0, (0, common_1.Query)()),
        __param(1, (0, common_1.Body)()),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", [Object, Object]),
        __metadata("design:returntype", void 0),
    ],
    AppController.prototype,
    "hydeSearch",
    null
);
__decorate(
    [
        (0, common_1.Post)("/testcase/generate"),
        (0, common_1.HttpCode)(200),
        __metadata("design:type", Function),
        __metadata("design:paramtypes", []),
        __metadata("design:returntype", void 0),
    ],
    AppController.prototype,
    "testGenerator",
    null
);
exports.AppController = AppController = __decorate(
    [(0, common_1.Controller)(), __metadata("design:paramtypes", [app_service_1.AppService])],
    AppController
);
//# sourceMappingURL=app.controller.js.map
