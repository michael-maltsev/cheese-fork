//https://github.com/bloomtime/boolean-expression-js
//var ReParse = require('reparse').ReParse;
var BooleanExpression = (function () {

// --------------- grammar bits -------------------

function expr() {
  return this.chainl1(term, disjunction);
}

function term() {
  return this.chainl1(notFactor, conjunction);
}

function notFactor() {
  return this.choice(negation, factor);
}

function factor() {
  return this.choice(group, phrase, word);
}

function group() {
  return this.between(/^\(/, /^\)/, expr);
}

function phrase() {
  return this.between(/^\"/, /^\"/, words);
}

function words() {
  return this.many1(word).join(' ');
}

function word() {
  return this.match(/^[#@_\-'&!\w\dàèìòùáéíóúäëïöüâêîôûçßåøñœæ]+/i).toString();
}

function notop() {
  return this.match(/^NOT/i).toUpperCase();
}

function negation() {
  return this.seq(notop, notFactor).slice(1);
}

function conjunction() {
  return OPTREES[this.match(/^AND/i).toUpperCase()];
}

function disjunction() {
  return OPTREES[this.match(/^OR/i).toUpperCase()];
}

var OPTREES = {
  'AND': function(a,b) { return [ 'AND', a, b ] },
  'OR': function(a,b) { return [ 'OR', a, b ] }
};

// --------------- test strings -------------------

function evalTree(tree, text) {
  if (!Array.isArray(tree)) {
    return text.indexOf(tree) >= 0;
    // TODO: cache these regexps?
    //return new RegExp("\\b"+tree+"\\b", "i").test(text);
  }
  var op = tree[0];
  if (op == 'OR') {
    return evalTree(tree[1], text) || evalTree(tree[2], text);
  }
  else if (op == 'AND') {
      return evalTree(tree[1], text) && evalTree(tree[2], text);
  }
  else if (op == 'NOT') {
      return !evalTree(tree[1], text);
  }
}

// --------------- collect terms -------------------

function flattenTree(tree) {
  // TODO: unique leaves, sorted?
  return collectLeaves(tree, [], true);
}

function collectLeaves(tree, leaves, notnot) {
  if (!Array.isArray(tree)) {
    if (notnot) {
      leaves.push(tree);
    }
  }
  else {
    if (tree[0] == "NOT") {
      notnot = !notnot;
    }
    // i = 1 to skip AND/OR
    for (var i = 1; i < tree.length; i++) {
      collectLeaves(tree[i], leaves, notnot);
    }
  }
  return leaves;
}

// --------------- public interface -------------------

function Expression(query) {
    this.tree = new ReParse(query, true).start(expr);
}

Expression.prototype = {
    flatten: function() {
        return flattenTree(this.tree);
    },
    test: function(text) {
        return evalTree(this.tree, text);
    }
}

//module.exports = Expression;

return Expression;
})();
