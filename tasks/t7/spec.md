JSON Schema Subset Validator

Create `src/validate.js` exporting one named ESM function, `validateSchema(schema, value)`. It validates `value` against a JSON-schema subset and returns a fresh result object on every call: `{ok, errors}`, where `errors` is a new array of strings and `ok` is true exactly when `errors` is empty. Node.js builtins only, no external packages. ESM.

Recognized schema keywords:
- `type`: one of "object", "array", "string", "number", "boolean", "null".
- `properties`: object mapping property names to subschemas.
- `required`: array of property-name strings.
- `items`: subschema applied to every element of an array.
- `enum`: array of allowed values.

Any other keyword is ignored. Assume the schema is well-formed. Never mutate either argument.

Type matching: "object" iff the value is not null, not an array, and has typeof "object"; "array" iff Array.isArray; "string"/"boolean" iff typeof matches; "number" iff typeof is number and the value is not NaN (Infinity matches); "null" iff the value is null.

Applicability: `required` and `properties` apply only when the value is a non-null, non-array object, regardless of the `type` keyword; otherwise they impose no constraint. `required` checks own-property presence (Object.hasOwn), so a property set to undefined counts as present. `properties` validates a key only when the value has that own property, recursing into its subschema. `items` applies only when the value is an array. `enum` always applies: the value must be structurally equal to some enum element — primitives including null compare with Object.is (so NaN matches NaN); arrays compare elementwise with equal length; objects have equal key sets and structurally equal values for every key.

Every present keyword is checked independently; a failed type does not suppress other checks. Keywords are always evaluated in this fixed order, regardless of schema key order: type, required, properties, items, enum. Within `required`, errors follow the required array's order; within `properties`, the properties object's own key order; within `items`, ascending index.

Paths: the root path is the empty string. Descending into property k gives `k` when the current path is empty, otherwise `path.k`. Descending into array index i gives `path[i]`. Every error string is exactly `<path>: <detail>`: type failure `expected <type>`; required failure `missing required property "<name>"` with the name in double quotes; enum failure `value not in enum`.

Example: for schema `{type:"object", properties:{items:{type:"array", items:{type:"object", properties:{name:{type:"string"}}, required:["name"]}}}}` and value `{items:[{name:"a"}, 42, {name:3}]}`, the result is `{ok:false, errors:["items[1]: expected object", "items[2].name: expected string"]}`. Because the root path is empty, a root-level type failure reads exactly `: expected string`.
