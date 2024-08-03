//https://github.com/weaver/ReParse
//exports.ReParse = ReParse;

function ReParse(input, ignorews) {
  this.input = input;
  this.ignoreWS = ignorews;
}

ReParse.prototype.eof = function() {
  return this.input == '';
};

// Indicate failure, optionally resetting the input to a previous
// state.
ReParse.prototype.fail = function(input) {
  if (input !== undefined)
    this.input = input;
  throw this.fail;
};

// Execute a production, which could be a function or a RegExp.
ReParse.prototype.produce = function(method) {
  var val = (method instanceof RegExp) ? this.match(method) : method.call(this);
  this.ignoreWS && this.skipWS();
  return val;
};

// Begin parsing using the given production, return the result.  All
// input must be consumed.
ReParse.prototype.start = function(method) {
  var val;

  this.ignoreWS && this.skipWS();

  try {
    val = this.produce(method);
    if (this.eof())
      return val;
  } catch (err) {
    if (err !== this.fail)
      throw err;
  }

  throw new Error("Could not parse '" + this.input + "'.");
};

// Try to produce a value from method.  If it fails, restore the input
// to its previous state.
ReParse.prototype.maybe = function(method) {
  var input = this.input;

  try {
    return this.produce(method);
  } catch (err) {
    if (err !== this.fail)
      throw err;
  }
  return this.fail(input);
};

// If the production method fails, don't fail, just return otherwise.
ReParse.prototype.option = function(method, otherwise) {
  try {
    return this.maybe(method);
  } catch (err) {
    if (err !== this.fail)
      throw err;
    return otherwise;
  }
};

// Return the value produced by body.  This is equivalent to
// seq(left, body, right)[0].
ReParse.prototype.between = function(left, right, body) {
  var input = this.input,
      val;

  try {
    this.produce(left);
    val = this.produce(body);
    this.produce(right);
    return val;
  } catch (err) {
    if (err !== this.fail)
      throw err;
  }

  return this.fail(input);
};

// Match a regular expression, returning the first captured group or
// the matched string.
ReParse.prototype.match = function match(pattern) {
  var probe = this.input.match(pattern);

  if (!probe)
    return this.fail();

  this.input = this.input.substr(probe[0].length);
  return probe[1] === undefined ? probe[0] : probe[1];
};

// Return the result of the first production that matches.
ReParse.prototype.choice = function choice() {
  var input = this.input;

  for (var i = 0, l = arguments.length; (i < l); i++)
    try {
      return this.produce(arguments[i]);
    } catch (err) {
      if (err !== this.fail)
        throw err;
    }

  return this.fail(input);
};

// Match every production in a sequence, returning a list of the
// values produced.
ReParse.prototype.seq = function every() {
  var val = new Array(arguments.length + 1),
      input = this.input;

  try {
    for (var i = 0, l = arguments.length; i < l; i++)
      val[i + 1] = this.produce(arguments[i]);
    val[0] = input.substr(0, input.length - this.input.length);
    return val;
  } catch (err) {
    if (err !== this.fail)
      throw err;
  }

  return this.fail(input);
};

// Skip zero or more instances of method.  Return the parser.
ReParse.prototype.skip = function skip(method, min) {
  var found = 0,
      input = this.input;

  while (!this.eof())
    try {
      this.maybe(method);
      found += 1;
    } catch (err) {
      if (err !== this.fail)
        throw err;
      break;
    }

  return (min && found < min) ? this.fail(input) : this;
};

ReParse.prototype.skip1 = function(method) {
  return this.skip(method, 1);
};

ReParse.prototype.skipWS = function() {
  this.match(/^\s*/);
  return this;
};

// Return a list of zero or more productions.
ReParse.prototype.many = function many(method, min) {
  var result = [],
      input = this.input;

  while (!this.eof())
    try {
      result.push(this.maybe(method));
    } catch (err) {
      if (err !== this.fail)
        throw err;
      break;
    }

  return (min && (result.length < min)) ? this.fail(input) : result;
};

ReParse.prototype.many1 = function(method) {
  return this.many(method, 1);
};

// Return the array of values produced by method with sep between each
// value.
ReParse.prototype.sepBy = function(method, sep, min) {
  var result = [],
      orig = this.input,
      input;

  try {
    result.push(this.produce(method));
    while (!this.eof())
      try {
        input = this.input;
        this.produce(sep);
        result.push(this.produce(method));
      } catch (err) {
        if (err !== this.fail)
          throw err;
        this.fail(input);
      }
  } catch (err) {
    if (err !== this.fail)
      throw err;
  }

  return (min && (result.length < min)) ? this.fail(orig) : result;
};

ReParse.prototype.sepBy1 = function(method, sep) {
  return this.sepBy(method, sep, 1);
};

// Return the array of values produced by method.  The series must be
// terminated by end.
ReParse.prototype.endBy = function(method, end, min) {
  var val = this.many(method, min);
  this.option(end);
  return val;
};

ReParse.prototype.endBy1 = function(method, end) {
  return this.endBy(method, end, 1);
};

// Return the array of values produced by method with sep between each
// value.  The series may be terminated by a sep.
ReParse.prototype.sepEndBy = function(method, sep, min) {
  var val = this.sepBy(method, sep, min);
  this.option(sep);
  return val;
};

ReParse.prototype.sepEndBy1 = function(method, sep) {
  return this.sepEndBy(method, sep, 1);
};

ReParse.prototype.chainl = function(method, op, otherwise, min) {
  var found = 0,
      result = otherwise,
      orig = this.input,
      input;

  try {
    result = this.maybe(method);
    found++;
    while (!this.eof())
      try {
        input = this.input;
        result = this.produce(op)(result, this.produce(method));
        found++;
      } catch (err) {
        if (err !== this.fail)
          throw err;
        this.fail(input);
      }
  } catch (err) {
    if (err !== this.fail)
      throw err;
  }

  return (min && (found < min)) ? this.fail(input) : result;
};

ReParse.prototype.chainl1 = function(method, op) {
  return this.chainl(method, op, undefined, 1);
};
