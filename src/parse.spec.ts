import { parse, PHPTypes } from './parse';

describe( 'Parser', () => {

	test( 'CustomObject Empty', () => {
		expect( parse( 'C:9:"ClassName":0:{}' ) )
			.toEqual( new PHPTypes.PHPCustomObject( 20, '', 'ClassName' ) );
	} );

	test( 'CustomObject Simple', () => {
		expect( parse( 'C:9:"ClassName":15:{serialized data}' ) )
			.toEqual( new PHPTypes.PHPCustomObject( 36, 'serialized data', 'ClassName' ) );
	} );

	test( 'Null', () => {
		expect( parse( 'N;' ) )
			.toEqual( new PHPTypes.PHPNull() );
	} );

	test( 'Object Empty', () => {
		expect( parse( 'O:8:"stdClass":0:{}' ) )
			.toEqual( new PHPTypes.PHPObject( 19, new Map(), 'stdClass' ) );
	} );

	test( 'Object Simple', () => {
		expect( parse( 'O:8:"stdClass":1:{s:3:"foo";s:3:"bar";}' ) )
			.toEqual( new PHPTypes.PHPObject(
				39,
				new Map( [
					[ new PHPTypes.PHPString( 10, 'foo' ), new PHPTypes.PHPString( 10, 'bar' ) ]
				] ),
				'stdClass'
			) );
	} );

	test( 'Object Nested', () => {
		expect( parse( 'O:8:"stdClass":2:{s:1:"0";O:8:"stdClass":1:{s:1:"0";s:3:"foo";}s:1:"1";O:8:"stdClass":1:{s:1:"0";s:3:"bar";}}' ) )
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
	} );

	test( 'Reference', () => {
		expect( parse( 'R:1;' ) )
			.toEqual( new PHPTypes.PHPReference( 4, 1 ) );
	} );

	test( 'String Empty', () => {
		expect( parse( 's:0:"";' ) )
			.toEqual( new PHPTypes.PHPString( 7, '' ) );
	} );

	test( 'String Complicated', () => {
		expect( parse( 's:103:"This text - "s:38:"She exclaimed "Hello?" into the phone.";" - is an example of a serialized PHP value.";' ) )
			.toEqual( new PHPTypes.PHPString( 112, 'This text - "s:38:"She exclaimed "Hello?" into the phone.";" - is an example of a serialized PHP value.' ) );
	} );

	test( 'String Emoji', () => {
		expect( parse( 's:4:"🐊";' ) )
			.toEqual( new PHPTypes.PHPString( 9, '🐊' ) );
	} );

	test( 'Array Empty', () => {
		expect( parse( 'a:0:{}' ) )
			.toEqual( new PHPTypes.PHPArray( 6, new Map( [] ) ) );
	} );

	test( 'Array Simple', () => {
		expect( parse( 'a:2:{i:0;s:3:"foo";i:1;s:3:"bar";}' ) )
			.toEqual( new PHPTypes.PHPArray( 34, new Map( [
				[ new PHPTypes.PHPInteger( 4, 0 ), new PHPTypes.PHPString( 10, 'foo' ) ],
				[ new PHPTypes.PHPInteger( 4, 1 ), new PHPTypes.PHPString( 10, 'bar' ) ],
			] ) ) );
	} );

	test( 'Array Nested', () => {
		expect( parse( 'a:2:{i:0;a:1:{i:0;s:3:"foo";}i:1;a:1:{i:0;s:3:"bar";}}' ) )
			.toEqual( new PHPTypes.PHPArray( 54, new Map( [
				[ new PHPTypes.PHPInteger( 4, 0 ), new PHPTypes.PHPArray( 20, new Map( [
					[ new PHPTypes.PHPInteger( 4, 0 ), new PHPTypes.PHPString( 10, 'foo' ) ],
				] ) ) ],
				[ new PHPTypes.PHPInteger( 4, 1 ), new PHPTypes.PHPArray( 20, new Map( [
					[ new PHPTypes.PHPInteger( 4, 0 ), new PHPTypes.PHPString( 10, 'bar' ) ],
				] ) ) ],
			] ) ) );
	} );

	test( 'Boolean False', () => {
		expect( parse( 'b:0;' ) )
			.toEqual( new PHPTypes.PHPBoolean( 4, false ) );
	} );

	test( 'Boolean True', () => {
		expect( parse( 'b:1;' ) )
			.toEqual( new PHPTypes.PHPBoolean( 4, true ) );
	} );

	test( 'Float Positive', () => {
		const token = parse( 'd:12.34;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( 12.34 );
		expect( token.length ).toEqual( 8 );
	} );

	test( 'Float Negative', () => {
		const token = parse( 'd:-12.34;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( -12.34 );
		expect( token.length ).toEqual( 9 );
	} );

	test( 'Float Scientific Notation Positive', () => {
		const token = parse( 'd:1.1111111111111112E+69;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( 1.1111111111111112e+69 );
		expect( token.length ).toEqual( 25 );
	} );

	test( 'Float Scientific Notation Negative', () => {
		const token = parse( 'd:-1.1111111111111112E+69;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( -1.1111111111111112e+69 );
		expect( token.length ).toEqual( 26 );
	} );

	test( 'Float Infinity Positive', () => {
		const token = parse( 'd:INF;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBe( Infinity );
		expect( token.length ).toEqual( 6 );
	} );

	test( 'Float Infinity Negative', () => {
		const token = parse( 'd:-INF;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBe( -Infinity );
		expect( token.length ).toEqual( 7 );
	} );

	test( 'Float NaN', () => {
		const token = parse( 'd:NAN;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeNaN();
		expect( token.length ).toEqual( 6 );
	} );

	test( 'Integer Positive', () => {
		const token = parse( 'i:1234;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPInteger );
		expect( token.value ).toBe( 1234 );
		expect( token.length ).toEqual( 7 );
	} );

	test( 'Integer Negative', () => {
		const token = parse( 'i:-1234;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPInteger );
		expect( token.value ).toBe( -1234 );
		expect( token.length ).toEqual( 8 );
	} );

} );
