let objectReferences: any[];

export type ParseOptions = {
	fixNulls: boolean,
};

export type AccessModifier = 'public' | 'protected' | 'private';

export type PHPObjectPropertyInfo = {
	accessModifier: AccessModifier,
	propertyName: string,
};

let parseOptions: Partial<ParseOptions> = {};

export function parse( input: string, options: Partial<ParseOptions> = {} ) {

	objectReferences = [ null ];

	parseOptions = options;

	return _parse( input );

}

function _parse( input: string ) {

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

export function toJs(
	object: PHPTypes.AllTypes,
	options: Partial<PHPTypes.ToJsOptions> = {},
	seen: WeakMap<PHPTypes.AllTypes, any> = new WeakMap()
): PHPTypes.ValueTypes {

	if ( !object || typeof object !== 'object' ) return object;

	const objectClass = object.constructor as PHPTypes.AllTypeClasses;

	if ( ! Object.values( PHPTypes.identifierMap ).includes( objectClass ) ) {
		return object as any;
	}

	if ( object instanceof PHPTypes.PHPReference ) {
		object = object.value;
	}

	if ( seen.has( object ) ) {
		return seen.get( object )!;
	}

	const jsValue = objectClass.toJs( object as any, options );

	seen.set( object, jsValue );

	if ( object instanceof PHPTypes.PHPArray || object instanceof PHPTypes.PHPObject ) {

		const objectValue = jsValue as Record<string, PHPTypes.AllTypes>;

		for ( let [ key, value ] of Object.entries( objectValue ) ) {
			( jsValue as any )[ key ] = toJs( value, options, seen );
		}

	}

	return jsValue as any;

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

			if ( parseOptions.fixNulls ) {
				// Let's see what we can do about this

				// Maybe the nulls have been converted into a replacement character.
				// This is the easiest to fix.
				if ( value.substr( 0, 1 ) === '\ufffd' ) {
					input = input.replace( /\ufffd/g, '\u0000' );
					return parseFixedLengthString( input, openingDelimiter, closingDelimiter );
				}

				// Maybe the nulls are missing, and we overshot the end of the string.

				let nullCount: number;
				const valueStart = byteCountMatches[ 0 ].length + openingDelimiter.length;

				// Check for lambdas. String should have ended one byte early, and the value should start with "lambda_".
				nullCount = 1;
				if (
					decoder.decode( allBytes.slice( byteCount - nullCount, byteCount - nullCount + closingDelimiter.length + 1 ) ) === closingDelimiter + ';'
					&& /^lambda_\d+$/.test( value.substr( 0, value.length - nullCount ) )
				) {
					input = input.substr( 0, valueStart ) + '\u0000' + input.substr( valueStart );
					let [ value ] = parseFixedLengthString( input, openingDelimiter, closingDelimiter );
					return [ value, offset - nullCount + closingDelimiter.length ]; // Original offset to keep everything matched up
				}

				// Check for protected properties with a leading asterisk. String should have ended two bytes early.
				nullCount = 2;
				if (
					decoder.decode( allBytes.slice( byteCount - nullCount, byteCount - nullCount + closingDelimiter.length + 1 ) ) === closingDelimiter + ';'
					&& value.substr( 0, 1 ) === '*'
				) {
					input = input.replace( '*', '\u0000*\u0000' );
					let [ value ] = parseFixedLengthString( input, openingDelimiter, closingDelimiter );
					return [ value, offset - nullCount + closingDelimiter.length ]; // Original offset to keep everything matched up
				}

				// Check for private properties. String should have ended two bytes early.
				nullCount = 2;
				if ( decoder.decode( allBytes.slice( byteCount - nullCount, byteCount - nullCount + closingDelimiter.length + 1 ) ) === closingDelimiter + ';' ) {
					// Can't determine the class name from here.
					// Just prefix with two nulls and check in the toJS method.
					input = input.substr( 0, valueStart ) + '\u0000\u0000' + input.substr( valueStart );
					let [ value ] = parseFixedLengthString( input, openingDelimiter, closingDelimiter );
					return [ value, offset - nullCount + closingDelimiter.length ]; // Original offset to keep everything matched up
				}

			} else {

				throw new Error( 'Failed to parse fixed-length string' );

			}
		}

		return [ value, offset ];
	} else {
		throw new Error( 'Failed to parse fixed-length string' );
	}

}

export function makeRegExpClass<T>( regex: RegExp, valueParser: ( input: string ) => T ) {

	return class RegExpClass {

		constructor( public length: number, public value: T ) {
			objectReferences.push( this );
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

		toJs() {
			return RegExpClass.toJs( this );
		}

		static toJs( instance: RegExpClass ) {
			return instance.value as T;
		}

	}

}

export namespace PHPTypes {

	export type PHPReferenceIdentifier = 'R' | 'r';
	export class PHPReference {

		static regex = /^[Rr]:([^;]+);/;

		constructor( public length: number, public value: AllTypes ) { }

		static build( input: string ): PHPReference {

			const matches = input.match( this.regex );

			if ( matches !== null ) {
				const value = parseInt( matches[ 1 ] );

				if ( !( value in objectReferences ) ) {
					throw new Error( 'Invalid Reference' );
				}

				const object = objectReferences[ value ];

				if ( object instanceof PHPReference ) {
					throw new Error( 'Invalid Reference' );
				}

				return new this( matches[ 0 ].length, object );
			} else {
				throw new Error( 'Failed to parse PHPReference' );
			}

		}

		toJs( options: Partial<ToJsOptions> = {} ) {
			return PHPReference.toJs( this, options );
		}

		static toJs( instance: PHPReference, options: Partial<ToJsOptions> = {} ) {
			return toJs( instance.value, options );
		}

	}

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

		constructor( public length: number, public value: string, public className: string ) {
			objectReferences.push( this );
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

		toJs() {
			return toJs( this ) as string;
		}

		static toJs( instance: PHPCustomObject ) {
			return instance.value;
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

					const key = _parse( input.substr( offset ) ) as unknown as K;
					offset += key.length;

					// Keys cannot be referenced
					objectReferences.pop();

					const value = _parse( input.substr( offset ) );
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
			super();

			objectReferences.push( this );
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

				const instance = new this( offset, new Map(), className );

				const [ map, valueLength ] = this.parseMap<PHPString>( input.substr( offset ) );
				offset += valueLength;

				instance.length = offset;
				instance.value = map;

				return instance;

			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

		protected jsValue: Record<string, Record<string, AllTypes>> = {};

		toJs( options: Partial<ToJsOptions> = {} ) {
			return toJs( this, options ) as Record<string, ValueTypes>;
		}

		static propertyInfo( propertyName: string, className: string ): PHPObjectPropertyInfo {

			let accessModifier: AccessModifier = 'public';

			const protectedRegExp = /^\u0000\*\u0000/;
			// Also handle double nulls caused by fixing missing nulls
			const privateRegExp = new RegExp( `^\u0000(\u0000${className}|${className}\u0000)` );

			if ( propertyName.charCodeAt( 0 ) === 0 ) {
				if ( protectedRegExp.test( propertyName ) ) {
					propertyName = propertyName.replace( protectedRegExp, '' );
					accessModifier = 'protected';
				} else if ( privateRegExp.test( propertyName ) ) {
					propertyName = propertyName.replace( privateRegExp, '' );
					accessModifier = 'private';
				}
			}
			return { accessModifier, propertyName };
		}

		static toJs( instance: PHPObject, options: Partial<ToJsOptions> = {} ): Record<string, AllTypes> {

			const optionsHash = JSON.stringify( options );
			const cached = instance.jsValue[ optionsHash ];

			if ( cached ) {
				return cached;
			}

			const output: Record<string, AllTypes> = {};

			for ( const [ PHPKey, PHPValue ] of instance.value.entries() ) {

				let key = PHPKey.toJs();

				if ( typeof key === 'string' ) {

					let { accessModifier, propertyName } = this.propertyInfo( key, instance.className );

					key = propertyName;

					if ( accessModifier !== 'public' && !options.private ) {
						continue;
					}
				}

				output[ key ] = PHPValue;
			}

			instance.jsValue[ optionsHash ] = output;

			return output;
		}

	}

	export type PHPArrayIdentifier = 'a';
	export class PHPArray extends MappedData {

		static regex = /^a:/;

		constructor( public length: number, public value: Map<PHPString | PHPInteger, AllTypes> ) {
			super();

			objectReferences.push( this );
		}

		static build( input: string ): PHPArray {

			const matches = input.match( this.regex );

			if ( matches !== null ) {
				let offset = matches[ 0 ].length;

				const instance = new this( offset, new Map() );

				const [ map, mapLength ] = this.parseMap( input.substr( offset ) );
				offset += mapLength;

				instance.length = offset;
				instance.value = map;

				return instance;

			} else {
				throw new Error( 'Failed to parse ' + this.name );
			}

		}

		protected jsValue: Record<string, ( AllTypes[] | Record<string, AllTypes> )> = {};

		toJs( options: Partial<ToJsOptions> = {} ) {
			return toJs( this, options ) as ValueTypes[] | Record<string, ValueTypes>;
		}

		static toJs( instance: PHPArray, options: Partial<ToJsOptions> = {} ): AllTypes[] | Record<string, AllTypes> {

			const optionsHash = JSON.stringify( options );
			const cached = instance.jsValue[ optionsHash ];

			if ( cached ) {
				return cached;
			}

			// Borrow the toJs method from PHPObject, then attempt to convert the result to an array.

			const outputObject: Record<string, AllTypes> = PHPObject.toJs( instance as any, options );

			if ( options.detectArrays ) {

				const outputArray: AllTypes[] = [];

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
					instance.jsValue[ optionsHash ] = outputArray;
					return outputArray;
				}

			}

			instance.jsValue[ optionsHash ] = outputObject;

			return outputObject;

		}

	}

	export type PHPStringIdentifier = 's';
	export class PHPString {

		static regex = /^s:/;

		constructor( public length: number, public value: string ) {
			objectReferences.push( this );
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

		toJs() {
			return PHPString.toJs( this );
		}

		static toJs( instance: PHPString ) {

			// Remove nulls from lambdas
			if ( /^\u0000lambda_\d+$/.test( instance.value ) ) {
				return instance.value.replace( /\u0000/g, '' );
			}

			return instance.value;
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
