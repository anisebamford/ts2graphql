"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateType = void 0;
const graphql_1 = require("graphql");
exports.DateType = new graphql_1.GraphQLScalarType({
    name: 'Date',
    serialize: (date) => {
        if (!(date instanceof Date)) {
            throw new Error("Date object expected");
        }
        else {
            if (Number.isNaN(date.getTime())) {
                throw new Error('Invalid response date');
            }
            return date.toJSON();
        }
    },
    parseValue: val => {
        if (typeof val === "string")
            return parse(val);
        else
            throw new Error("String value expected.");
    },
    parseLiteral(ast) {
        if (ast.kind === graphql_1.Kind.STRING) {
            return parse(ast.value);
        }
        return null;
    },
});
function parse(val) {
    const date = new Date(val);
    if (val.length !== 24 || Number.isNaN(date.getTime())) {
        throw new graphql_1.GraphQLError('Incorrect Date: ' + val);
    }
    return date;
}
