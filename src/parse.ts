export function parse( input: string ): PHPTypes.Types {

	if ( typeof input !== 'string' ) {
		throw new TypeError( 'Input must be a string' );
	}

	input = input.trim();

	const tokenIdentifier = input.substr( 0, 1 ) as PHPTypes.Identifiers;

	if ( tokenIdentifier in PHPTypes.identifierMap ) {
		return PHPTypes.identifierMap[ tokenIdentifier ].build( input );
	} else {
		throw new Error( `Failed to decode identifier "${tokenIdentifier}".` );
	}

}

export function parseFixedLengthString( input: string, openingDelimiter = '"', closingDelimiter = '"' ): [ string, number ] {

	const bytesRegex = /(\d+):/;

	const byteCountMatches = input.match( bytesRegex );

	if ( byteCountMatches !== null ) {
		let offset = byteCountMatches[ 0 ].length;
		const byteCount = parseInt( byteCountMatches[ 1 ] );

		if ( input.substr( offset, openingDelimiter.length ) === openingDelimiter ) {
			offset += openingDelimiter.length;
		} else {
			throw new Error( 'Failed to parse fixed-length string' );
		}

		// We need to read bytes manually so the lengths match up with PHP.

		const encoder = new TextEncoder();
		const decoder = new TextDecoder();
		const allBytes = encoder.encode( input.substr( offset ) );
		const valueBytes = allBytes.slice( 0, byteCount );
		const value = decoder.decode( valueBytes );

		offset += value.length;

		if ( input.substr( offset, closingDelimiter.length ) === closingDelimiter ) {
			offset += closingDelimiter.length;
		} else {
			throw new Error( 'Failed to parse fixed-length string' );
		}

		return [ value, offset ];
	} else {
		throw new Error( 'Failed to parse fixed-length string' );
	}

}

export function makeRegExpClass<T>( regex: RegExp, valueParser: ( input: string ) => T ) {

	return class RegExpClass extends PHPTypes.Base {

		constructor( public length: number, public value: T ) {
			super();
		}

		static build( input: string ): RegExpClass {

			const matches = input.match( regex );

			if ( matches !== null ) {
				const value = valueParser( matches[ 1 ] );
				return new this( matches[ 0 ].length, value );
			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

	}

}

export namespace PHPTypes {

	export abstract class Base {
		abstract length: number;
	}

	export type PHPReferenceIdentifier = 'R' | 'r';
	export class PHPReference extends makeRegExpClass( /^[Rr]:([^;]+);/, input => parseInt( input ) ) { }

	export type PHPBooleanIdentifier = 'b';
	export class PHPBoolean extends makeRegExpClass( /^b:([01]);/, input => globalThis.Boolean( parseInt( input ) ) ) { }

	export type PHPFloatIdentifier = 'd';
	export class PHPFloat extends makeRegExpClass( /^d:([^;]+);/, input => parseFloat( input.replace( 'INF', 'Infinity' ) ) ) { }

	export type PHPIntegerIdentifier = 'i';
	export class PHPInteger extends makeRegExpClass( /^i:([^;]+);/, input => parseInt( input ) ) { }

	export type PHPNullIdentifier = 'N';
	export class PHPNull extends makeRegExpClass( /^N;/, input => null ) {
		constructor() {
			super( 2, null );
		}
	}

	export type PHPCustomObjectIdentifier = 'C';
	export class PHPCustomObject extends Base {

		static regex = /^C:/;

		constructor( public length: number, public value: string, public className: string ) {
			super();
		}

		static build( input: string ): PHPCustomObject {

			const matches = input.match( this.regex );

			if ( matches !== null ) {
				let offset = matches[ 0 ].length;

				const [ className, classNameLength ] = parseFixedLengthString( input.substr( offset ) );
				offset += classNameLength;

				if ( input.substr( offset, 1 ) === ':' ) {
					offset += 1;
				} else {
					throw new Error( 'Failed to parse ' + this.name );
				}

				let [ value, valueLength ] = parseFixedLengthString( input.substr( offset ), '{', '}' );
				offset += valueLength;

				return new this( offset, value, className );
			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

	}

	export abstract class MappedData extends Base {

		static mapRegex = /(\d+):/;

		static parseMap( input: string, openingDelimiter = '{', closingDelimiter = '}' ): [ Map<Types, Types>, number ] {

			const countMatches = input.match( this.mapRegex );

			if ( countMatches !== null ) {
				const count = parseInt( countMatches[ 1 ] );
				let offset = countMatches[ 0 ].length;

				if ( input.substr( offset, openingDelimiter.length ) === openingDelimiter ) {
					offset += openingDelimiter.length;
				} else {
					throw new Error( 'Failed to parse ' + this.name );
				}

				const map: Map<Types, Types> = new Map();

				for ( let i = 0; i < count; i++ ) {

					const key = parse( input.substr( offset ) );
					offset += key.length;

					const value = parse( input.substr( offset ) );
					offset += value.length;

					map.set( key, value );
				}

				if ( input.substr( offset, closingDelimiter.length ) === closingDelimiter ) {
					offset += closingDelimiter.length;
				} else {
					throw new Error( 'Failed to parse ' + this.name );
				}

				return [ map, offset ];
			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

	}

	export type PHPObjectIdentifier = 'O';
	export class PHPObject extends MappedData {

		static regex = /^O:/;

		constructor( public length: number, public value: Map<Types, Types>, public className: string ) {
			super()
		}

		static build( input: string ): PHPObject {

			const matches = input.match( this.regex );

			if ( matches !== null ) {
				let offset = matches[ 0 ].length;

				const [ className, classNameLength ] = parseFixedLengthString( input.substr( offset ) );
				offset += classNameLength;

				if ( input.substr( offset, 1 ) === ':' ) {
					offset += 1;
				} else {
					throw new Error( 'Failed to parse ' + this.name );
				}

				const [ value, valueLength ] = this.parseMap( input.substr( offset ) );
				offset += valueLength;

				return new this( offset, value, className );
			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

	}

	export type PHPArrayIdentifier = 'a';
	export class PHPArray extends MappedData {

		static regex = /^a:/;

		constructor( public length: number, public value: Map<Types, Types> ) {
			super();
		}

		static build( input: string ): PHPArray {

			const matches = input.match( this.regex );

			if ( matches !== null ) {
				let offset = matches[ 0 ].length;

				const [ map, mapLength ] = this.parseMap( input.substr( offset ) );
				offset += mapLength;

				return new this( offset, map );
			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

	}

	export type PHPStringIdentifier = 's';
	export class PHPString extends Base {

		static regex = /^s:/;

		constructor( public length: number, public value: string ) {
			super();
		}

		static build( input: string ): PHPString {

			const matches = input.match( this.regex );

			if ( matches !== null ) {
				let offset = matches[ 0 ].length;

				let [ value, valueLength ] = parseFixedLengthString( input.substr( offset ) );
				offset += valueLength;

				if ( input.substr( offset, 1 ) === ';' ) {
					offset += 1;
				} else {
					throw new Error( 'Failed to parse ' + this.name );
				}

				return new this( offset, value );
			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

	}

	export type Types = PHPCustomObject
		| PHPNull
		| PHPObject
		| PHPReference
		| PHPString
		| PHPArray
		| PHPBoolean
		| PHPFloat
		| PHPInteger;

	export type TypeClasses = typeof PHPCustomObject
		| typeof PHPNull
		| typeof PHPObject
		| typeof PHPReference
		| typeof PHPString
		| typeof PHPArray
		| typeof PHPBoolean
		| typeof PHPFloat
		| typeof PHPInteger;

	export type Identifiers = PHPCustomObjectIdentifier
		| PHPNullIdentifier
		| PHPObjectIdentifier
		| PHPReferenceIdentifier
		| PHPStringIdentifier
		| PHPArrayIdentifier
		| PHPBooleanIdentifier
		| PHPFloatIdentifier
		| PHPIntegerIdentifier;

	function createIdentifierMap<T extends Record<Identifiers, V>, V extends TypeClasses>( map: T ) {
		return map;
	}

	export const identifierMap = createIdentifierMap( {
		C: PHPCustomObject,
		N: PHPNull,
		O: PHPObject,
		R: PHPReference,
		S: PHPString,
		a: PHPArray,
		b: PHPBoolean,
		d: PHPFloat,
		i: PHPInteger,
		r: PHPReference,
		s: PHPString,
	} );

}
