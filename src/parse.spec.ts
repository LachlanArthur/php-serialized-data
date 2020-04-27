import { parse, PHPTypes, parseFixedLengthString } from './parse';

describe( 'Parser', () => {

	test( 'Invalid input', () => {
		expect( () => parse( [] as unknown as string ) )
			.toThrowError( 'Input must be a string' );
	} );

	test( 'Invalid identifier', () => {
		expect( () => parse( 'X;' ) )
			.toThrowError( 'Failed to match identifier "X"' );
	} );

	test( 'Invalid fixed-length string format', () => {
		expect( () => parseFixedLengthString( '1""' ) )
			.toThrowError( 'Failed to parse fixed-length string' );
	} );

} );

describe( 'CustomObject', () => {

	test( 'Empty', () => {
		const value = parse( 'C:9:"ClassName":0:{}' );
		expect( value )
			.toEqual( new PHPTypes.PHPCustomObject( 20, '', 'ClassName' ) );
		expect( value.toJs() )
			.toBe( '' );
	} );

	test( 'Simple', () => {
		const value = parse( 'C:9:"ClassName":15:{serialized data}' );
		expect( value )
			.toEqual( new PHPTypes.PHPCustomObject( 36, 'serialized data', 'ClassName' ) );
		expect( value.toJs() )
			.toBe( 'serialized data' );
	} );

	test( 'Bad class name', () => {
		expect( () => parse( 'C:9:"ClassName"15:{serialized data}' ) )
			.toThrowError( 'Failed to parse PHPCustomObject' );
	} );

} );

describe( 'Null', () => {

	test( 'Null', () => {
		const value = parse( 'N;' );
		expect( value )
			.toEqual( new PHPTypes.PHPNull() );
		expect( value.toJs() )
			.toBeNull();
	} );

	test( 'Non-matching regex', () => {
		expect( () => parse( 'N:;' ) )
			.toThrowError( 'Failed to parse PHPNull' );
	} );

} );

describe( 'Object', () => {

	test( 'Empty', () => {
		const value = parse( 'O:8:"stdClass":0:{}' );
		expect( value )
			.toEqual( new PHPTypes.PHPObject( 19, new Map(), 'stdClass' ) );
		expect( value.toJs() )
			.toEqual( {} );
	} );

	test( 'Simple', () => {
		const value = parse( 'O:8:"stdClass":1:{s:3:"foo";s:3:"bar";}' );
		expect( value )
			.toEqual( new PHPTypes.PHPObject(
				39,
				new Map( [
					[ new PHPTypes.PHPString( 10, 'foo' ), new PHPTypes.PHPString( 10, 'bar' ) ]
				] ),
				'stdClass'
			) );
		expect( value.toJs() )
			.toEqual( { foo: 'bar' } );
	} );

	test( 'Nested', () => {
		const value = parse( 'O:8:"stdClass":2:{s:1:"0";O:8:"stdClass":1:{s:1:"0";s:3:"foo";}s:1:"1";O:8:"stdClass":1:{s:1:"0";s:3:"bar";}}' );
		expect( value )
			.toEqual( new PHPTypes.PHPObject(
				109,
				new Map( [
					[ new PHPTypes.PHPString( 8, '0' ), new PHPTypes.PHPObject(
						37,
						new Map( [ [ new PHPTypes.PHPString( 8, '0' ), new PHPTypes.PHPString( 10, 'foo' ) ] ] ),
						'stdClass'
					) ],
					[ new PHPTypes.PHPString( 8, '1' ), new PHPTypes.PHPObject(
						37,
						new Map( [ [ new PHPTypes.PHPString( 8, '0' ), new PHPTypes.PHPString( 10, 'bar' ) ] ] ),
						'stdClass'
					) ],
				] ),
				'stdClass'
			) );
		expect( value.toJs() )
			.toEqual( {
				0: { 0: 'foo' },
				1: { 0: 'bar' },
			} );
	} );

} );

describe( 'Reference', () => {

	test( 'Reference', () => {
		const value = parse( 'R:1;' );
		expect( value )
			.toEqual( new PHPTypes.PHPReference( 4, 1 ) );
		expect( value.toJs() )
			.toBe( 1 );
	} );

	test( 'Non-matching regex', () => {
		expect( () => parse( 'R:;' ) )
			.toThrowError( 'Failed to parse PHPReference' );
	} );

} );

describe( 'String', () => {

	test( 'Empty', () => {
		const value = parse( 's:0:"";' );
		expect( value )
			.toEqual( new PHPTypes.PHPString( 7, '' ) );
		expect( value.toJs() )
			.toBe( '' );
	} );

	test( 'Complicated', () => {
		const value = parse( 's:103:"This text - "s:38:"She exclaimed "Hello?" into the phone.";" - is an example of a serialized PHP value.";' );
		expect( value )
			.toEqual( new PHPTypes.PHPString( 112, 'This text - "s:38:"She exclaimed "Hello?" into the phone.";" - is an example of a serialized PHP value.' ) );
		expect( value.toJs() )
			.toBe( 'This text - "s:38:"She exclaimed "Hello?" into the phone.";" - is an example of a serialized PHP value.' );
	} );

	test( 'Emoji', () => {
		const value = parse( 's:4:"🐊";' );
		expect( value )
			.toEqual( new PHPTypes.PHPString( 9, '🐊' ) );
		expect( value.toJs() )
			.toBe( '🐊' );
	} );

	test( 'Missing opening delimiter', () => {
		expect( () => parse( 's:1:a";' ) )
			.toThrowError( 'Failed to parse fixed-length string' );
	} );

	test( 'Missing closing delimiter', () => {
		expect( () => parse( 's:1:"a;' ) )
			.toThrowError( 'Failed to parse fixed-length string' );
	} );

	test( 'Length too large', () => {
		expect( () => parse( 's:2:"a";' ) )
			.toThrowError( 'Failed to parse fixed-length string' );
	} );

	test( 'Length too small', () => {
		expect( () => parse( 's:0:"a";' ) )
			.toThrowError( 'Failed to parse fixed-length string' );
	} );

} );

describe( 'Array', () => {

	test( 'Empty', () => {
		const value = parse( 'a:0:{}' );
		expect( value )
			.toEqual( new PHPTypes.PHPArray( 6, new Map( [] ) ) );
		expect( value.toJs() )
			.toEqual( {} );
	} );

	test( 'Simple', () => {
		const value = parse( 'a:2:{i:0;s:3:"foo";i:1;s:3:"bar";}' );
		expect( value )
			.toEqual( new PHPTypes.PHPArray( 34, new Map( [
				[ new PHPTypes.PHPInteger( 4, 0 ), new PHPTypes.PHPString( 10, 'foo' ) ],
				[ new PHPTypes.PHPInteger( 4, 1 ), new PHPTypes.PHPString( 10, 'bar' ) ],
			] ) ) );
		expect( value.toJs() )
			.toEqual( {
				0: 'foo',
				1: 'bar',
			} );
	} );

	test( 'Nested', () => {
		const value = parse( 'a:2:{i:0;a:1:{i:0;s:3:"foo";}i:1;a:1:{i:0;s:3:"bar";}}' );
		expect( value )
			.toEqual( new PHPTypes.PHPArray( 54, new Map( [
				[ new PHPTypes.PHPInteger( 4, 0 ), new PHPTypes.PHPArray( 20, new Map( [
					[ new PHPTypes.PHPInteger( 4, 0 ), new PHPTypes.PHPString( 10, 'foo' ) ],
				] ) ) ],
				[ new PHPTypes.PHPInteger( 4, 1 ), new PHPTypes.PHPArray( 20, new Map( [
					[ new PHPTypes.PHPInteger( 4, 0 ), new PHPTypes.PHPString( 10, 'bar' ) ],
				] ) ) ],
			] ) ) );
		expect( value.toJs() )
			.toEqual( {
				0: { 0: 'foo' },
				1: { 0: 'bar' },
			} );
	} );

	test( 'Sparse', () => {
		const value = parse( 'a:1:{i:100;s:3:"foo";}' );
		expect( value )
			.toEqual( new PHPTypes.PHPArray( 22, new Map( [
				[ new PHPTypes.PHPInteger( 6, 100 ), new PHPTypes.PHPString( 10, 'foo' ) ],
			] ) ) );
		expect( value.toJs() )
			.toEqual( {
				100: 'foo',
			} );
	} );

} );

describe( 'Boolean', () => {

	test( 'False', () => {
		const value = parse( 'b:0;' );
		expect( value )
			.toEqual( new PHPTypes.PHPBoolean( 4, false ) );
		expect( value.toJs() )
			.toBe( false );
	} );

	test( 'True', () => {
		const value = parse( 'b:1;' );
		expect( value )
			.toEqual( new PHPTypes.PHPBoolean( 4, true ) );
		expect( value.toJs() )
			.toBe( true );
	} );

	test( 'Non-matching regex', () => {
		expect( () => parse( 'b:;' ) )
			.toThrowError( 'Failed to parse PHPBoolean' );
	} );

} );

describe( 'Float', () => {

	test( 'Simple Positive', () => {
		const token = parse( 'd:12.34;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( 12.34 );
		expect( token.length ).toBe( 8 );
		expect( token.toJs() ).toBeCloseTo( 12.34 );
	} );

	test( 'Simple Negative', () => {
		const token = parse( 'd:-12.34;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( -12.34 );
		expect( token.length ).toBe( 9 );
		expect( token.toJs() ).toBeCloseTo( -12.34 );
	} );

	test( 'Scientific Notation Positive', () => {
		const token = parse( 'd:1.1111111111111112E+69;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( 1.1111111111111112e+69 );
		expect( token.length ).toBe( 25 );
		expect( token.toJs() ).toBeCloseTo( 1.1111111111111112e+69 );
	} );

	test( 'Scientific Notation Negative', () => {
		const token = parse( 'd:-1.1111111111111112E+69;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( -1.1111111111111112e+69 );
		expect( token.length ).toBe( 26 );
		expect( token.toJs() ).toBeCloseTo( -1.1111111111111112e+69 );
	} );

	test( 'Infinity Positive', () => {
		const token = parse( 'd:INF;' );
		expect( token )
			.toEqual( new PHPTypes.PHPFloat( 6, Infinity ) );
		expect( token.toJs() )
			.toBe( Infinity );
	} );

	test( 'Infinity Negative', () => {
		const token = parse( 'd:-INF;' );
		expect( token )
			.toEqual( new PHPTypes.PHPFloat( 7, -Infinity ) );
		expect( token.toJs() )
			.toBe( -Infinity );
	} );

	test( 'NaN', () => {
		const token = parse( 'd:NAN;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeNaN();
		expect( token.length ).toBe( 6 );
		expect( token.toJs() ).toBeNaN();
	} );

	test( 'Non-matching regex', () => {
		expect( () => parse( 'd:;' ) )
			.toThrowError( 'Failed to parse PHPFloat' );
	} );

} );

describe( 'Integer', () => {

	test( 'Positive', () => {
		const token = parse( 'i:1234;' );
		expect( token )
			.toEqual( new PHPTypes.PHPInteger( 7, 1234 ) );
		expect( token.toJs() )
			.toBe( 1234 );
	} );

	test( 'Negative', () => {
		const token = parse( 'i:-1234;' );
		expect( token )
			.toEqual( new PHPTypes.PHPInteger( 8, -1234 ) );
		expect( token.toJs() )
			.toBe( -1234 );
	} );

	test( 'Non-matching regex', () => {
		expect( () => parse( 'i:;' ) )
			.toThrowError( 'Failed to parse PHPInteger' );
	} );

} );
