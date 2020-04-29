export function parse( input: string ): PHPTypes.AllTypes {

	if ( typeof input !== 'string' ) {
		throw new TypeError( 'Input must be a string' );
	}

	input = input.trim();

	const tokenIdentifier = input.substr( 0, 1 ) as PHPTypes.Identifiers;

	if ( tokenIdentifier in PHPTypes.identifierMap ) {
		return PHPTypes.identifierMap[ tokenIdentifier ].build( input );
	} else {
		throw new Error( `Failed to match identifier "${tokenIdentifier}".` );
	}

}

export function parseFixedLengthString( input: string, openingDelimiter = '"', closingDelimiter = '"' ): [ string, number ] {

	const byteCountRegex = /(\d+):/;

	const byteCountMatches = input.match( byteCountRegex );

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

	return class RegExpClass {

		constructor( public length: number, public value: T ) { }

		static build( input: string ): RegExpClass {

			const matches = input.match( regex );

			if ( matches !== null ) {
				const value = valueParser( matches[ 1 ] );
				return new this( matches[ 0 ].length, value );
			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

		toJs() {
			return this.value as T;
		}

	}

}

export namespace PHPTypes {

	export type PHPReferenceIdentifier = 'R' | 'r';
	export class PHPReference extends makeRegExpClass<number>( /^[Rr]:([^;]+);/, input => parseInt( input ) ) { }

	export type PHPBooleanIdentifier = 'b';
	export class PHPBoolean extends makeRegExpClass<boolean>( /^b:([01]);/, input => Boolean( parseInt( input ) ) ) { }

	export type PHPFloatIdentifier = 'd';
	export class PHPFloat extends makeRegExpClass<number>( /^d:([^;]+);/, input => parseFloat( input.replace( 'INF', 'Infinity' ) ) ) { }

	export type PHPIntegerIdentifier = 'i';
	export class PHPInteger extends makeRegExpClass<number>( /^i:([^;]+);/, input => parseInt( input ) ) { }

	export type PHPNullIdentifier = 'N';
	export class PHPNull extends makeRegExpClass<null>( /^N;/, input => null ) {
		constructor() {
			super( 2, null );
		}
	}

	export type PHPCustomObjectIdentifier = 'C';
	export class PHPCustomObject {

		static regex = /^C:/;

		constructor( public length: number, public value: string, public className: string ) { }

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

		toJs() {
			return this.value;
		}

	}

	export abstract class MappedData {

		static mapRegex = /(\d+):/;

		static parseMap<K extends PHPString | PHPInteger>( input: string, openingDelimiter = '{', closingDelimiter = '}' ): [ Map<K, AllTypes>, number ] {

			const countMatches = input.match( this.mapRegex );

			if ( countMatches !== null ) {
				const count = parseInt( countMatches[ 1 ] );
				let offset = countMatches[ 0 ].length;

				if ( input.substr( offset, openingDelimiter.length ) === openingDelimiter ) {
					offset += openingDelimiter.length;
				} else {
					throw new Error( 'Failed to parse ' + this.name );
				}

				const map: Map<K, AllTypes> = new Map();

				for ( let i = 0; i < count; i++ ) {

					const key = parse( input.substr( offset ) ) as unknown as K;
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

		constructor( public length: number, public value: Map<PHPString, AllTypes>, public className: string ) {
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

				const [ value, valueLength ] = this.parseMap<PHPString>( input.substr( offset ) );
				offset += valueLength;

				return new this( offset, value, className );
			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

		toJs( options: Partial<ToJsOptions> = {} ): Record<string, ValueTypes> {
			const output: Record<string, ValueTypes> = {};

			for ( const [ PHPKey, PHPValue ] of this.value.entries() ) {

				let key = PHPKey.toJs();
				let value = PHPValue.toJs( options );

				if ( typeof key === 'string' && key.charCodeAt( 0 ) === 0 ) {
					if ( options.private ) {
						key = key.replace( /\u0000.+\u0000/, '' );
					} else {
						continue;
					}
				}

				output[ key ] = value;
			}

			return output;
		}

	}

	export type PHPArrayIdentifier = 'a';
	export class PHPArray extends MappedData {

		static regex = /^a:/;

		constructor( public length: number, public value: Map<PHPString | PHPInteger, AllTypes> ) {
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

		toJs( options: Partial<ToJsOptions> = {} ): ValueTypes[] | Record<string, ValueTypes> {

			// Borrow the toJs method from PHPObject, then attempt to convert the result to an array.

			const outputObject: Record<string, ValueTypes> = PHPObject.prototype.toJs.call( this, options );

			if ( options.detectArrays ) {

				const outputArray: ValueTypes[] = [];

				const stringKeys: string[] = Object.keys( outputObject );
				const numberKeys: number[] = [];

				if ( stringKeys.length === 0 ) return [];

				const allKeysAreNumbers = stringKeys.every( stringKey => {
					const numberKey = parseInt( stringKey );
					numberKeys.push( numberKey );
					return numberKey.toString() === stringKey;
				} );

				if ( allKeysAreNumbers ) {
					for ( const numberKey of numberKeys ) {
						outputArray[ numberKey ] = outputObject[ numberKey ];
					}
					return outputArray;
				}

			}

			return outputObject;

		}

	}

	export type PHPStringIdentifier = 's';
	export class PHPString {

		static regex = /^s:/;

		constructor( public length: number, public value: string ) { }

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

		toJs() {
			return this.value;
		}

	}

	export type AllTypes = PHPCustomObject
		| PHPNull
		| PHPObject
		| PHPReference
		| PHPString
		| PHPArray
		| PHPBoolean
		| PHPFloat
		| PHPInteger;

	export type AllTypeClasses = typeof PHPCustomObject
		| typeof PHPNull
		| typeof PHPObject
		| typeof PHPReference
		| typeof PHPString
		| typeof PHPArray
		| typeof PHPBoolean
		| typeof PHPFloat
		| typeof PHPInteger;

	export type ValueTypes = { [ key in string | number ]: ValueTypes }
		| ValueTypes[]
		| PHPCustomObject[ 'value' ]
		| PHPNull[ 'value' ]
		| PHPReference[ 'value' ]
		| PHPString[ 'value' ]
		| PHPBoolean[ 'value' ]
		| PHPFloat[ 'value' ]
		| PHPInteger[ 'value' ];

	export type Identifiers = PHPCustomObjectIdentifier
		| PHPNullIdentifier
		| PHPObjectIdentifier
		| PHPReferenceIdentifier
		| PHPStringIdentifier
		| PHPArrayIdentifier
		| PHPBooleanIdentifier
		| PHPFloatIdentifier
		| PHPIntegerIdentifier;

	function createIdentifierMap<T extends Record<Identifiers, V>, V extends AllTypeClasses>( map: T ) {
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

	export type ToJsOptions = {
		private: boolean,
		detectArrays: boolean,
	};

}
