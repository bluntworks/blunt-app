module.exports = function merge (a, b) {
  if(a && b) for(var k in b)  a[k] = b[k]
  return a
}
