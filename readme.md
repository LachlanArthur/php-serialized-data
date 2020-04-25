# php-serialized-data

Parse PHP serialized data with JS

PHP's `serialize` function doesn't have a spec, so I used the handy [Kaitai Struct spec](https://formats.kaitai.io/php_serialized_value/index.html) as reference instead

## Usage

```js
import { parse } from 'php-serialized-data';

const data = parse( 'O:8:"stdClass":1:{s:3:"foo";s:3:"bar";}' );

/*
PHPObject(
  className: 'stdClass'
  value: Map [
    [ PHPString( 'foo' ), PHPString( 'bar' ) ],
  ]
)
*/
```

It even works with multi-byte data like emoji:

```js
import { parse } from 'php-serialized-data';

const data = parse( 's:4:"🐊";' );

/*
PHPString(
  value: '🐊'
)
*/
```

## Supports

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
- Output conversion to plain JS types
  - Nulls in private/protected class property names
- Throw on trailing data
