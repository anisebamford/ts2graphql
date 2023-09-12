import { GraphQLScalarType, GraphQLSchema } from 'graphql';
import { Primitive } from 'ts-type-ast';
type CustomScalarFactory = (type: Primitive) => GraphQLScalarType | undefined;
export declare function createSchema(fileName: string, options?: {
    customScalars?: GraphQLScalarType[];
    customScalarFactory?: CustomScalarFactory;
}): GraphQLSchema;
export {};
