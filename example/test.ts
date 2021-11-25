type ID = number;
type Float = number;
type Int = number;
interface MainQuery {
    foo: Foo;
}
interface Foo {
    __typename: 'Foo';
    id: ID;
    name: string;
    value?: number;
    size: Int;
    br: Bar;
    baz: Baz;
    coord: {
        __typename: 'Coord';
        /** Hey */
        x: Float;
        y: Float;
    };
}

type Union = Foo | Bar;

/**
 * Bar doc
 */
interface Bar extends Foo {
    /** Doc for bar */
    bar?: string;
    items: Foo[];
    items2?: Foo[][];
    /**
     * Long doc for hi
     */
    hi?: Union;
}

interface Baz {
    retInt(args: { a?: Int; b?: string; c?: boolean; d: boolean }): Int;
    foo(args: {
        /** some doc */
        foo?: number;
    }): Bar;
}

interface Query {
    mainQuery: MainQuery;
}