# Testing Module Example

*Note* There is a known grpc issue.

```bash
# if you run into
# (node:198654) UnhandledPromiseRejectionWarning: TypeError: Cannot compose insecure credential
#    at Object.exports.combineChannelCredentials (/path/to/firebase-js-sdk/examples/testing/node_modules/grpc/src/credentials.js)

sed -i -e '178d' node_modules/grpc/src/credentials.js
```
