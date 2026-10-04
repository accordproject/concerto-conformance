# Concertino golden documents

Expected [Concertino](https://github.com/accordproject/concerto/tree/main/packages/concertino)
output for representative Concerto models. Each directory under `cases/`
holds the input model (one or more `.cto` files) and the Concertino document
the converter must produce for it (`concertino.json`).

The documents are written in **Concertino format 5.1.0**
(`metadata.concertinoVersion`). The format follows semantic versioning: a
minor version only adds optional fields, and readers accept every document
of the same major version. A change to a golden document that removes or
changes an existing field is a breaking format change and needs a new major
version; adding an optional field needs a new minor version.

| case | what it covers |
|---|---|
| `concepts-and-inheritance` | abstract concepts, a three-level `extends` chain with the inherited properties copied down (`inheritedFrom`), `identified by` and `identified`, arrays, optional properties, defaults |
| `system-types` | participants, assets, transactions and events: `prototype`, the implicit system super types (`systemSuperTypes`), and the system properties `$identifier` and `$timestamp` (`isSystem`, inherited from `concerto@1.0.0.*`) |
| `scalars-and-validators` | every scalar type, regex, length, one-sided and two-sided ranges, falsy defaults (`""`, `0`, `0.0`, `false`), the scalar's validators copied onto the property (`scalarType`), collection sizes |
| `enums-and-maps` | enum-typed (`isEnum`) and map-typed (`isMap`) properties; map keys of `String`, `DateTime` and a scalar; enum, concept and relationship map values |
| `relationships` | relationship properties (`isRelationship`), single and array |
| `decorators-and-vocabulary` | `@Term` and `@Term_*` in `vocabulary` wherever they are, `decoratorOrder` when they are not first, decorator arguments of every kind (string, boolean, number, type reference, array type reference), decorators on enum values, map keys and values, scalars, and the model |
| `imports-and-aliases` | two namespaces, an aliased import (`Address as Location`: Concertino names the declared type), an imported enum and scalar |

## Checking

`check.js` loads each case into a concerto-core `ModelManager`
(`enableMapType` and `importAliasing` on), converts its resolved metamodel
(`getAst(true)`) with `convertToConcertino`, and checks that:

1. the result equals `concertino.json`;
2. it passes the Concertino schema check (`ConcertinoConverter.isValid`);
3. it converts back (`convertToMetamodel`) to the same resolved metamodel.

```sh
node concertino/check.js
```

Format 5.1.0 is written by `@accordproject/concertino` from the Concerto R1
release. Until that is published, point the check at a concerto checkout:

```sh
CONCERTO_CORE=../concerto/packages/concerto-core \
CONCERTINO=../concerto/packages/concertino \
node concertino/check.js
```

`node concertino/check.js --update` rewrites every `concertino.json` from the
converter. Review the diff: the golden documents are the reference, not the
converter.
