# php-serialized-data

Parse PHP serialized data with JavaScript.

PHP's [serialize function](https://www.php.net/manual/en/function.serialize) doesn't have a spec, so I used the handy [Kaitai Struct spec](https://formats.kaitai.io/php_serialized_value/index.html) as reference instead

```shell
yarn add php-serialized-data
```

Or use it directly in the browser:

```js
import { parse } from 'https://cdn.pika.dev/php-serialized-data';
```

## Usage Examples

```js
import { parse } from 'php-serialized-data';

const data = parse( 'O:8:"stdClass":2:{s:3:"foo";s:3:"bar";s:16:"\u0000stdClass\u0000secret";s:3:"shh";}' );

/*
PHPObject(
  className: 'stdClass',
  value: Map( [
    [ PHPString( value: 'foo' ), PHPString( value: 'bar' ) ],
    [ PHPString( value: '\u0000stdClass\u0000secret' ), PHPString( value: 'shh' ) ],
  ] ),
)
*/

data.toJs();

/*
{ foo: 'bar' }
*/

data.toJs( { private: true } );

/*
{ foo: 'bar', secret: 'shh' }
*/
```

It even works with multi-byte data like emoji:

```js
import { parse } from 'php-serialized-data';

const data = parse( 's:4:"🐊";' );

/*
PHPString( value: '🐊' )
*/

data.toJs();

/*
'🐊'
*/
```

### Parsing options

The main `parse()` function takes two parameters, the input string, and an options object.

```js
parse( input, options? )
```

|Option|Type|Default|Description|
|---|---|---|---|
|`fixNulls`|Boolean|`false`|Attempt to fix missing/broken null chars in input.<br>Useful when the input was pasted from the clipboard.|

The `fixNulls` option attempts to fix the following scenarios:

- Nulls have been replaced with the Unicode replacement character &#xfffd;. This can happen if the serialized string was output into a HTML page.
- Nulls are missing. This usually happens if the value was copied to the clipboard. If the string byte count was larger than the content, then the following fixes are attempted, depending on the content of the string.
  - If the byte count is larger by 1, and the value starts with `lambda_`, then the string is probably a serialized lambda function.
  - If the byte count is larger by 2, and the value starts with an asterisk `*`, then the string is probably a protected property.
  - If the byte count is larger by 2, and the other scenarios do not apply, the string is probably a private class property.

## JS Value Conversion

Use the `.toJs()` method on the output to convert to native JavaScript types.

```js
value.toJs( options? )
```

The `.toJs()` method accepts an options object:

|Option|Type|Default|Description|
|---|---|---|---|
|`private`|Boolean|`false`|Include private & protected class properties|
|`detectArrays`|Boolean|`false`|Output arrays where possible, instead of objects|

## Supports PHP Types

- Null
- Integer
- Float
  - Infinity
  - NaN
  - Scientific notation
- String
  - Multi-byte (e.g. emoji)
- Boolean
- Array
- Object
  - Classes
  - Custom Objects (contain arbitrary serialized data. e.g. `SplDoublyLinkedList`)
- Reference
  - Value Reference
  - Object Reference
  - Circular Reference

## TODO

- Throw on trailing data
- Option to ignore string lengths (should fix newline mismatches & trimmed whitespace)
