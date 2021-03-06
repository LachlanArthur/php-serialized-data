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

	test( 'Private/protected properties', () => {
		const value = parse( 'O:8:"stdClass":3:{s:3:"foo";s:3:"bar";s:9:"\u0000*\u0000locked";s:9:"\u0000lambda_1";s:16:"\u0000stdClass\u0000secret";s:3:"shh";}' );
		expect( value )
			.toEqual( new PHPTypes.PHPObject(
				105,
				new Map( [
					[ new PHPTypes.PHPString( 10, 'foo' ), new PHPTypes.PHPString( 10, 'bar' ) ],
					[ new PHPTypes.PHPString( 16, '\u0000*\u0000locked' ), new PHPTypes.PHPString( 16, '\u0000lambda_1' ) ],
					[ new PHPTypes.PHPString( 24, '\u0000stdClass\u0000secret' ), new PHPTypes.PHPString( 10, 'shh' ) ],
				] ),
				'stdClass'
			) );
		expect( value.toJs() )
			.toEqual( { foo: 'bar' } );
		expect( value.toJs( { private: true } ) )
			.toEqual( { foo: 'bar', locked: 'lambda_1', secret: 'shh' } );
	} );

	test( 'Private/protected properties - replaced nulls', () => {
		const value = parse( 'O:8:"stdClass":3:{s:3:"foo";s:3:"bar";s:9:"\ufffd*\ufffdlocked";s:9:"\ufffdlambda_1";s:16:"\ufffdstdClass\ufffdsecret";s:3:"shh";}', { fixNulls: true } );
		expect( value )
			.toEqual( new PHPTypes.PHPObject(
				105,
				new Map( [
					[ new PHPTypes.PHPString( 10, 'foo' ), new PHPTypes.PHPString( 10, 'bar' ) ],
					[ new PHPTypes.PHPString( 16, '\u0000*\u0000locked' ), new PHPTypes.PHPString( 16, '\u0000lambda_1' ) ],
					[ new PHPTypes.PHPString( 24, '\u0000stdClass\u0000secret' ), new PHPTypes.PHPString( 10, 'shh' ) ],
				] ),
				'stdClass'
			) );
		expect( value.toJs() )
			.toEqual( { foo: 'bar' } );
		expect( value.toJs( { private: true } ) )
			.toEqual( { foo: 'bar', locked: 'lambda_1', secret: 'shh' } );
	} );

	test( 'Private/protected properties - missing nulls', () => {
		const value = parse( 'O:8:"stdClass":3:{s:3:"foo";s:3:"bar";s:9:"*locked";s:9:"lambda_1";s:16:"stdClasssecret";s:3:"shh";}', { fixNulls: true } );
		expect( value )
			.toEqual( new PHPTypes.PHPObject(
				100,
				new Map( [
					[ new PHPTypes.PHPString( 10, 'foo' ), new PHPTypes.PHPString( 10, 'bar' ) ],
					[ new PHPTypes.PHPString( 14, '\u0000*\u0000locked' ), new PHPTypes.PHPString( 15, '\u0000lambda_1' ) ],
					[ new PHPTypes.PHPString( 22, '\u0000\u0000stdClasssecret' ), new PHPTypes.PHPString( 10, 'shh' ) ],
				] ),
				'stdClass'
			) );
		expect( value.toJs() )
			.toEqual( { foo: 'bar' } );
		expect( value.toJs( { private: true } ) )
			.toEqual( { foo: 'bar', locked: 'lambda_1', secret: 'shh' } );
	} );

} );

describe( 'Reference', () => {

	test( 'Value', () => {
		const value = parse( 'a:2:{i:0;s:3:"foo";i:1;R:2;}' );
		let references: PHPTypes.AllTypes[] = [];
		expect( value )
			.toEqual( new PHPTypes.PHPArray( 28, new Map<PHPTypes.PHPInteger | PHPTypes.PHPString, PHPTypes.AllTypes>( [
				[ new PHPTypes.PHPInteger( 4, 0 ), ( references[ 2 ] = new PHPTypes.PHPString( 10, 'foo' ) ) ],
				[ new PHPTypes.PHPInteger( 4, 1 ), new PHPTypes.PHPReference( 4, references[ 2 ] ) ],
			] ) ) );
		expect( value.toJs( { detectArrays: true } ) )
			.toEqual( [ 'foo', 'foo' ] );
	} );

	test( 'Object', () => {
		const value = parse( 'a:2:{i:0;O:8:"stdClass":1:{s:3:"foo";s:3:"bar";}i:1;R:2;}' );
		let references: PHPTypes.AllTypes[] = [];
		expect( value )
			.toEqual( new PHPTypes.PHPArray( 57, new Map<PHPTypes.PHPInteger | PHPTypes.PHPString, PHPTypes.AllTypes>( [
				[ new PHPTypes.PHPInteger( 4, 0 ), ( references[ 2 ] = new PHPTypes.PHPObject( 39, new Map<PHPTypes.PHPString, PHPTypes.AllTypes>( [
					[ new PHPTypes.PHPString( 10, 'foo' ), new PHPTypes.PHPString( 10, 'bar' ) ]
				] ), 'stdClass' ) ) ],
				[ new PHPTypes.PHPInteger( 4, 1 ), new PHPTypes.PHPReference( 4, references[ 2 ] ) ],
			] ) ) );

		const obj = { foo: 'bar' };
		const result = [ obj, obj ];

		const js = value.toJs( { detectArrays: true } );

		expect( js )
			.toEqual( result );

		expect( js[ 0 ] )
			.toBe( js[ 1 ] );
	} );

	test( 'Circular', () => {
		const value = parse( 'a:2:{i:0;O:8:"stdClass":1:{s:1:"b";O:8:"stdClass":1:{s:1:"a";R:2;}}i:1;r:3;}' );
		let references: PHPTypes.AllTypes[] = [];

		references[ 2 ] = new PHPTypes.PHPObject( 58, new Map<PHPTypes.PHPString, PHPTypes.AllTypes>( [] ), 'stdClass' );
		references[ 3 ] = new PHPTypes.PHPObject( 31, new Map<PHPTypes.PHPString, PHPTypes.AllTypes>( [] ), 'stdClass' );

		references[ 2 ].value.set( new PHPTypes.PHPString( 8, 'b' ), references[ 3 ] );
		references[ 3 ].value.set( new PHPTypes.PHPString( 8, 'a' ), new PHPTypes.PHPReference( 4, references[ 2 ] ) );

		const circular = new PHPTypes.PHPArray( 76, new Map<PHPTypes.PHPInteger | PHPTypes.PHPString, PHPTypes.AllTypes>( [
			[ new PHPTypes.PHPInteger( 4, 0 ), references[ 2 ] ],
			[ new PHPTypes.PHPInteger( 4, 1 ), new PHPTypes.PHPReference( 4, references[ 3 ] ) ],
		] ) );

		expect( value )
			.toEqual( circular );

		const resultA: any = {};
		const resultB: any = {};
		resultA.b = resultB;
		resultB.a = resultA;
		const result = [ resultA, resultB ];

		const js = value.toJs( { detectArrays: true } );

		expect( js )
			.toEqual( result );

		expect( js[ 0 ].b )
			.toBe( js[ 1 ] );

		expect( js[ 1 ].a )
			.toBe( js[ 0 ] );
	} );

	test( 'Bare Reference', () => {
		expect( () => parse( 'R:1;' ) )
			.toThrowError( 'Invalid Reference' );
	} );

	test( 'Invalid Reference', () => {
		expect( () => parse( 'a:2:{i:0;s:3:"foo";i:1;R:5;}' ) )
			.toThrowError( 'Invalid Reference' );
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

	test( 'Fix broken nulls - utf-8 replacement character', () => {
		const value = parse( 's:16:"\ufffdstdClass\ufffdsecret";', { fixNulls: true } );
		expect( value )
			.toEqual( new PHPTypes.PHPString( 24, '\u0000stdClass\u0000secret' ) );
		expect( value.toJs() )
			.toEqual( '\u0000stdClass\u0000secret' );
	} );

	test( 'Fix missing nulls - protected property', () => {
		const value = parse( 's:9:"*secret";', { fixNulls: true } );
		expect( value )
			.toEqual( new PHPTypes.PHPString( 14, '\u0000*\u0000secret' ) );
		expect( value.toJs() )
			.toEqual( '\u0000*\u0000secret' );
	} );

	test( 'Fix missing nulls - private property', () => {
		const value = parse( 's:16:"stdClasssecret";', { fixNulls: true } );
		expect( value )
			.toEqual( new PHPTypes.PHPString( 22, '\u0000\u0000stdClasssecret' ) );
		expect( value.toJs() )
			.toEqual( '\u0000\u0000stdClasssecret' );
	} );

	test( 'Fix missing nulls - lambda', () => {
		const value = parse( 's:9:"lambda_1";', { fixNulls: true } );
		expect( value )
			.toEqual( new PHPTypes.PHPString( 15, '\u0000lambda_1' ) );
		expect( value.toJs() )
			.toEqual( 'lambda_1' );
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
		expect( value.toJs( { detectArrays: true } ) )
			.toEqual( [] );
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
				'0': 'foo',
				'1': 'bar',
			} );
		expect( value.toJs( { detectArrays: true } ) )
			.toEqual( [
				'foo',
				'bar',
			] );
	} );

	test( 'Mixed keys', () => {
		const value = parse( 'a:2:{s:3:"foo";s:3:"bar";i:0;s:3:"baz";}' );
		expect( value )
			.toEqual( new PHPTypes.PHPArray( 40, new Map<PHPTypes.PHPString | PHPTypes.PHPInteger, PHPTypes.AllTypes>( [
				[ new PHPTypes.PHPString( 10, 'foo' ), new PHPTypes.PHPString( 10, 'bar' ) ],
				[ new PHPTypes.PHPInteger( 4, 0 ), new PHPTypes.PHPString( 10, 'baz' ) ],
			] ) ) );
		expect( value.toJs() )
			.toEqual( {
				foo: 'bar',
				'0': 'baz',
			} );
		expect( value.toJs( { detectArrays: true } ) )
			.toEqual( {
				foo: 'bar',
				'0': 'baz'
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
		expect( value.toJs( { detectArrays: true } ) )
			.toEqual( [
				[ 'foo' ],
				[ 'bar' ],
			] );
	} );

	test( 'Sparse', () => {
		const value = parse( 'a:1:{i:10;s:3:"foo";}' );
		expect( value )
			.toEqual( new PHPTypes.PHPArray( 21, new Map( [
				[ new PHPTypes.PHPInteger( 5, 10 ), new PHPTypes.PHPString( 10, 'foo' ) ],
			] ) ) );
		expect( value.toJs() )
			.toEqual( {
				10: 'foo',
			} );
		const sparseResult = [];
		sparseResult[ 10 ] = 'foo';
		expect( value.toJs( { detectArrays: true } ) )
			.toEqual( sparseResult );
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
