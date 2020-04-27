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

data.toJs( true ); // Expose private properties

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

## JS Value Conversion

Use the `.toJs()` method on the output to convert to native JavaScript types.

Pass `true` to also include private/protected properties.

Note that PHP arrays are transformed into JS objects, as PHP supports non-numeric keys.

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
- Object Reference
- Value Reference

## TODO

- Dereference object & value references
  - Also circular references
- Throw on trailing data
