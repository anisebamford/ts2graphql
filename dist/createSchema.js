"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSchema = void 0;
const graphql_1 = require("graphql");
const ts = require("typescript");
const date_1 = require("./date");
const ts_type_ast_1 = require("ts-type-ast");
function createSchema(fileName, options = {}) {
    const customScalarsMap = new Map();
    (options.customScalars || []).forEach(value => customScalarsMap.set(value.name, value));
    const customScalar = options.customScalarFactory;
    const program = ts.createProgram({ options: { strict: true }, rootNames: [fileName] });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(fileName);
    //@ts-ignore
    const types = (0, ts_type_ast_1.typeAST)(checker, sourceFile);
    const map = new Map();
    let anonTypeIdx = 0;
    const schema = createSchemaFromTypes();
    return schema;
    function createSchemaFromTypes() {
        let query;
        let mutation;
        for (let i = 0; i < types.length; i++) {
            const type = types[i];
            if (type.kind === 'interface' && (type.name === 'Query' || type.name === 'Mutation')) {
                const gqlType = createGQL(types[i], false);
                if (gqlType instanceof graphql_1.GraphQLObjectType) {
                    if (type.name === 'Query') {
                        query = gqlType;
                    }
                    if (type.name === 'Mutation') {
                        mutation = gqlType;
                    }
                }
            }
        }
        if (!(query || mutation))
            throw new Error("No 'Query' or 'Mutation' type found");
        return new graphql_1.GraphQLSchema({
            query: query,
            mutation: mutation,
        });
    }
    function add(type, gqltype) {
        map.set(type, gqltype);
        return gqltype;
    }
    function createGQL(type, isInput) {
        const gqlType = map.get(type);
        if (gqlType)
            return gqlType;
        switch (type.kind) {
            case 'interface':
            case 'interfaceLiteral':
                return createGQLType(type, isInput);
            case 'enum':
                return add(type, createGQLEnum(type));
            case 'union':
            case 'unionLiteral':
                if (isInput)
                    return add(type, createGQLInputUnion(type));
                else if (type.members.every(member => member.kind === 'primitive' && member.type === 'string'))
                    return graphql_1.GraphQLString;
                else if (type.members.every(member => member.kind === 'primitive' && member.type === 'number' && member.rawType === 'Int'))
                    return graphql_1.GraphQLInt;
                else if (type.members.every(member => member.kind === 'primitive' && member.type === 'number'))
                    return graphql_1.GraphQLFloat;
                else if (type.members.every(member => member.kind === 'primitive'))
                    throw new Error('Union primitives are not supported');
                return add(type, createGQLUnion(type));
            case 'array':
                return new graphql_1.GraphQLList(add(type, nullable(false, createGQL(type.element, isInput))));
            case 'native':
                if (type.name === 'Date') {
                    return nonNull(date_1.DateType);
                }
                throw new Error('Unexpected type: ' + type.name);
            case 'primitive':
                return add(type, createGQLPrimitive(type));
        }
        throw new Error('Unexpected type: ' + JSON.stringify(type));
    }
    function nullable(nullable, type) {
        return nullable || type instanceof graphql_1.GraphQLNonNull ? type : new graphql_1.GraphQLNonNull(type);
    }
    function createGQLType(type, isInput) {
        let typeName = type.kind === 'interface' ? type.name : '';
        const Class = isInput ? graphql_1.GraphQLInputObjectType : graphql_1.GraphQLObjectType;
        const fields = {};
        if (type.kind === 'interfaceLiteral') {
            for (let i = 0; i < type.members.length; i++) {
                const member = type.members[i];
                if (member.name === '__typename' &&
                    member.type.kind === 'primitive' &&
                    typeof member.type.literal === 'string') {
                    typeName = member.type.literal;
                }
            }
        }
        if (typeName === '')
            typeName = 'Anonymous' + (isInput ? 'Input' : '') + ++anonTypeIdx;
        const gqlType = new Class({
            name: typeName,
            description: type.kind === 'interface' ? type.doc : undefined,
            fields: fields,
        });
        add(type, gqlType);
        type.members.reduce((obj, member) => {
            // if (member.orUndefined) throw new Error('Undefined props are not supported in graphql');
            const memberType = {
                type: nullable(member.orNull || member.orUndefined, createGQL(member.type, false)),
                args: member.args && member.args.length === 1
                    ? member.args[0].type.members.reduce((acc, arg) => {
                        acc[arg.name] = {
                            description: arg.doc,
                            defaultValue: undefined,
                            type: nullable(arg.orNull, createGQL(arg.type, true)),
                        };
                        return acc;
                    }, {})
                    : undefined,
                // todo:
                deprecationReason: undefined,
                description: member.doc,
            };
            if (member.name !== '__typename') {
                obj[member.name] = memberType;
            }
            return obj;
        }, fields);
        return gqlType;
    }
    function createGQLUnion(type) {
        return new graphql_1.GraphQLUnionType({
            name: type.kind === 'union' ? type.name : 'AnonymousUnion' + ++anonTypeIdx,
            description: type.kind === 'union' ? type.doc : undefined,
            types: type.members.map(member => createGQL(member, false)),
        });
    }
    function createGQLInputUnion(type) {
        if (!type.members.every(m => m.kind === 'primitive' && m.type === 'string'))
            throw new Error('Input union supports only string unions');
        const union = type.members.map(m => m.kind === 'primitive' && m.literal);
        const validate = (val) => {
            if (typeof val !== "string" || !union.includes(val))
                throw new graphql_1.GraphQLError(`Input union: "${union.join(' | ')}" doesn't have value: ${val}`);
            return val;
        };
        return new graphql_1.GraphQLScalarType({
            name: type.kind === 'union' ? type.name : union.map(u => String(u).replace(/[^a-z]+/gi, '_')).join('__'),
            description: type.kind === 'union' ? type.doc : undefined,
            serialize: validate,
            parseValue: validate,
            parseLiteral(ast) {
                if (ast.kind === graphql_1.Kind.STRING) {
                    return validate(ast.value);
                }
            },
        });
    }
    function createGQLPrimitive(type) {
        if (type.rawType === 'ID')
            return graphql_1.GraphQLID;
        const customType = customScalarsMap.get(type.type);
        if (customType)
            return customType;
        if (customScalar) {
            const res = customScalar(type);
            if (res)
                return res;
        }
        switch (type.type) {
            case 'number':
                return type.rawType === 'Int' ? graphql_1.GraphQLInt : graphql_1.GraphQLFloat;
            case 'string':
                return graphql_1.GraphQLString;
            case 'boolean':
                return graphql_1.GraphQLBoolean;
        }
        throw new Error('Unexpected type: ' + JSON.stringify(type));
    }
    function createGQLEnum(type) {
        const values = type.types.reduce((acc, item, index) => {
            if (item.kind !== "primitive") {
                throw new Error(`Only string enum values are supported: ${JSON.stringify(type)}`);
            }
            else {
                if (item.type !== "string") {
                    throw new Error(`Only string enum values are supported: ${JSON.stringify(type)}`);
                }
                acc[item.literal] = { value: index };
            }
            return acc;
        }, {});
        return new graphql_1.GraphQLEnumType({
            name: type.name,
            values
        });
    }
}
exports.createSchema = createSchema;
function never(never) {
    throw new Error('Never possible');
}
function nonNull(val) {
    if (val === undefined)
        throw new Error('Undefined is not expected here');
    return val;
}
