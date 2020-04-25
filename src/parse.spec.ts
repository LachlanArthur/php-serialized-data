import { parse, PHPTypes } from './parse';

describe( 'Parser', () => {

	test( 'CustomObject Empty', () => {
		const [ token, increment ] = parse( 'C:9:"ClassName":0:{}' );
		expect( token ).toEqual( new PHPTypes.PHPCustomObject( '', 'ClassName' ) );
		expect( increment ).toBe( 20 );
	} );

	test( 'CustomObject Simple', () => {
		const [ token, increment ] = parse( 'C:9:"ClassName":15:{serialized data}' );
		expect( token ).toEqual( new PHPTypes.PHPCustomObject( 'serialized data', 'ClassName' ) );
		expect( increment ).toBe( 36 );
	} );

	test( 'Null', () => {
		const [ token, increment ] = parse( 'N;' );
		expect( token ).toEqual( new PHPTypes.PHPNull() );
		expect( increment ).toBe( 2 );
	} );

	test( 'Object Empty', () => {
		const [ token, increment ] = parse( 'O:8:"stdClass":0:{}' );
		expect( token ).toEqual( new PHPTypes.PHPObject( new Map(), 'stdClass' ) );
		expect( increment ).toBe( 19 );
	} );

	test( 'Object Simple', () => {
		const [ token, increment ] = parse( 'O:8:"stdClass":1:{s:3:"foo";s:3:"bar";}' );
		expect( token ).toEqual( new PHPTypes.PHPObject(
			new Map( [
				[ new PHPTypes.PHPString( 'foo' ), new PHPTypes.PHPString( 'bar' ) ]
			] ),
			'stdClass'
		) );
		expect( increment ).toBe( 39 );
	} );

	test( 'Object Nested', () => {
		const [ token, increment ] = parse( 'O:8:"stdClass":2:{s:1:"0";O:8:"stdClass":1:{s:1:"0";s:3:"foo";}s:1:"1";O:8:"stdClass":1:{s:1:"0";s:3:"bar";}}' );
		expect( token ).toEqual( new PHPTypes.PHPObject(
			new Map( [
				[ new PHPTypes.PHPString( '0' ), new PHPTypes.PHPObject(
					new Map( [ [ new PHPTypes.PHPString( '0' ), new PHPTypes.PHPString( 'foo' ) ] ] ),
					'stdClass'
				) ],
				[ new PHPTypes.PHPString( '1' ), new PHPTypes.PHPObject(
					new Map( [ [ new PHPTypes.PHPString( '0' ), new PHPTypes.PHPString( 'bar' ) ] ] ),
					'stdClass'
				) ],
			] ),
			'stdClass'
		) );
		expect( increment ).toBe( 109 );
	} );

	test( 'Reference', () => {
		const [ token, increment ] = parse( 'R:1;' );
		expect( token ).toEqual( new PHPTypes.PHPReference( 1 ) );
		expect( increment ).toBe( 4 );
	} );

	test( 'String Empty', () => {
		const [ token, increment ] = parse( 's:0:"";' );
		expect( token ).toEqual( new PHPTypes.PHPString( '' ) );
		expect( increment ).toBe( 7 );
	} );

	test( 'String Complicated', () => {
		const [ token, increment ] = parse( 's:103:"This text - "s:38:"She exclaimed "Hello?" into the phone.";" - is an example of a serialized PHP value.";' );
		expect( token ).toEqual( new PHPTypes.PHPString( 'This text - "s:38:"She exclaimed "Hello?" into the phone.";" - is an example of a serialized PHP value.' ) );
		expect( increment ).toBe( 112 );
	} );

	test( 'String Emoji', () => {
		const [ token, increment ] = parse( 's:4:"🐊";' );
		expect( token ).toEqual( new PHPTypes.PHPString( '🐊' ) );
		expect( increment ).toBe( 9 );
	} );

	test( 'Array Empty', () => {
		const [ token, increment ] = parse( 'a:0:{}' );
		expect( token ).toEqual( new PHPTypes.PHPArray( new Map( [] ) ) );
		expect( increment ).toBe( 6 );
	} );

	test( 'Array Simple', () => {
		const [ token, increment ] = parse( 'a:2:{i:0;s:3:"foo";i:1;s:3:"bar";}' );
		expect( token ).toEqual( new PHPTypes.PHPArray( new Map( [
			[ new PHPTypes.PHPInteger( 0 ), new PHPTypes.PHPString( 'foo' ) ],
			[ new PHPTypes.PHPInteger( 1 ), new PHPTypes.PHPString( 'bar' ) ],
		] ) ) );
		expect( increment ).toBe( 34 );
	} );

	test( 'Array Nested', () => {
		const [ token, increment ] = parse( 'a:2:{i:0;a:1:{i:0;s:3:"foo";}i:1;a:1:{i:0;s:3:"bar";}}' );
		expect( token ).toEqual( new PHPTypes.PHPArray( new Map( [
			[ new PHPTypes.PHPInteger( 0 ), new PHPTypes.PHPArray( new Map( [
				[ new PHPTypes.PHPInteger( 0 ), new PHPTypes.PHPString( 'foo' ) ],
			] ) ) ],
			[ new PHPTypes.PHPInteger( 1 ), new PHPTypes.PHPArray( new Map( [
				[ new PHPTypes.PHPInteger( 0 ), new PHPTypes.PHPString( 'bar' ) ],
			] ) ) ],
		] ) ) );
		expect( increment ).toBe( 54 );
	} );

	test( 'Boolean False', () => {
		const [ token, increment ] = parse( 'b:0;' );
		expect( token ).toEqual( new PHPTypes.PHPBoolean( false ) );
		expect( increment ).toBe( 4 );
	} );

	test( 'Boolean True', () => {
		const [ token, increment ] = parse( 'b:1;' );
		expect( token ).toEqual( new PHPTypes.PHPBoolean( true ) );
		expect( increment ).toBe( 4 );
	} );

	test( 'Float Positive', () => {
		const [ token, increment ] = parse( 'd:12.34;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( 12.34 );
		expect( increment ).toBe( 8 );
	} );

	test( 'Float Negative', () => {
		const [ token, increment ] = parse( 'd:-12.34;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( -12.34 );
		expect( increment ).toBe( 9 );
	} );

	test( 'Float Scientific Notation Positive', () => {
		const [ token, increment ] = parse( 'd:1.1111111111111112E+69;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( 1.1111111111111112e+69 );
		expect( increment ).toBe( 25 );
	} );

	test( 'Float Scientific Notation Negative', () => {
		const [ token, increment ] = parse( 'd:-1.1111111111111112E+69;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeCloseTo( -1.1111111111111112e+69 );
		expect( increment ).toBe( 26 );
	} );

	test( 'Float Infinity Positive', () => {
		const [ token, increment ] = parse( 'd:INF;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBe( Infinity );
		expect( increment ).toBe( 6 );
	} );

	test( 'Float Infinity Negative', () => {
		const [ token, increment ] = parse( 'd:-INF;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBe( -Infinity );
		expect( increment ).toBe( 7 );
	} );

	test( 'Float NaN', () => {
		const [ token, increment ] = parse( 'd:NAN;' );
		expect( token ).toBeInstanceOf( PHPTypes.PHPFloat );
		expect( token.value ).toBeNaN();
		expect( increment ).toBe( 6 );
	} );

	test( 'Integer Positive', () => {
		const [ token, increment ] = parse( 'i:1234;' );
		expect( token.value ).toBe( 1234 );
		expect( increment ).toBe( 7 );
	} );

	test( 'Integer Negative', () => {
		const [ token, increment ] = parse( 'i:-1234;' );
		expect( token.value ).toBe( -1234 );
		expect( increment ).toBe( 8 );
	} );

} );
