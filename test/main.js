const assert = require('./assert');
const htmlSoup = require('../dist');

const {TextNode, HtmlTag} = htmlSoup.parse;
function assertDomMatches(actual, expected) {
	if (expected.constructor === Array) {
		assert.instanceOf(actual, Array);
		assert.equal(actual.length, expected.length);
		for (let i = 0; i < expected.length; i++) assertDomMatches(actual[i], expected[i]);
	}
	else if (expected.constructor === Set) {
		assert.instanceOf(actual, Set);
		assert.equal(actual.size, expected.size);
		const expectedIterator = expected.values();
		const actualIterator = actual.values();
		let entry;
		while (!(entry = expectedIterator.next()).done) {
			assertDomMatches(entry.value, actualIterator.next().value);
		}
	}
	else {
		if (expected.constructor === TextNode) {
			assert.instanceOf(actual, TextNode);
			assert.equal(actual.text, expected.text);
		}
		else { //HtmlTag
			assert.instanceOf(actual, HtmlTag);
			for (let property of ['type', 'attributes']) assert.equal(actual[property], expected[property]);
			assert.equal(actual.children.length, expected.children.length);
			for (let i = 0; i < expected.children.length; i++) assertDomMatches(actual.children[i], expected.children[i]);
		}
	}
}

//Text
assertDomMatches(htmlSoup.parse('abc'), new TextNode('abc'));
assertDomMatches(htmlSoup.parse(' abc\n'), new TextNode('abc'));
assertDomMatches(htmlSoup.parse(' abc\n', false), new TextNode(' abc\n'));
assertDomMatches(htmlSoup.parse('abc&quot;def'), new TextNode('abc"def'));
assertDomMatches(htmlSoup.parse('abc&;'), new TextNode('abc&;'));
assertDomMatches(htmlSoup.parse('&#97;'), new TextNode('a'));
assertDomMatches(htmlSoup.parse('abc&'), new TextNode('abc&'));
assertDomMatches(htmlSoup.parse('abc <!--commented out-->\n'), new TextNode('abc <!--commented out-->'));
//HTML
assertDomMatches(htmlSoup.parse('<abc> \n\t </abc>'), new HtmlTag({type: 'abc', attributes: {}, children: []}));
assertDomMatches(htmlSoup.parse('<abc />'), new HtmlTag({type: 'abc', attributes: {}, children: []}));
assertDomMatches(htmlSoup.parse('<a /><b></b>'), [new HtmlTag({type: 'a', attributes: {}, children: []}), new HtmlTag({type: 'b', attributes: {}, children: []})]);
assertDomMatches(htmlSoup.parse('< br  >< br>< br>'), [new HtmlTag({type: 'br', attributes: {}, children: []}), new HtmlTag({type: 'br', attributes: {}, children: []}), new HtmlTag({type: 'br', attributes: {}, children: []})]);
assertDomMatches(htmlSoup.parse('<a><b>'), new HtmlTag({type: 'a', attributes: {}, children: [new HtmlTag({type: 'b', attributes: {}, children: []})]}));
assertDomMatches(htmlSoup.parse('\n\n<p> Some text </p>\n\n'), new HtmlTag({type: 'p', attributes: {}, children: [new TextNode('Some text')]}));
assertDomMatches(htmlSoup.parse('one<A><b><C /></b><d> </d></A><BR>two'), [
	new TextNode('one'),
	new HtmlTag({type: 'A', attributes: {}, children: [
		new HtmlTag({type: 'b', attributes: {}, children: [
			new HtmlTag({type: 'C', attributes: {}, children: []})
		]}),
		new HtmlTag({type: 'd', attributes: {}, children: []})
	]}),
	new HtmlTag({type: 'BR', attributes: {}, children: []}),
	new TextNode('two')
]);
assertDomMatches(htmlSoup.parse('<abc one two=3 four= five six =seven eight = "&quot;nine&quot;" ten=\'eleven\' >text</abc>'), new HtmlTag({type: 'abc', attributes: {
	one: true,
	two: '3',
	four: 'five',
	six: 'seven',
	eight: '"nine"',
	ten: 'eleven'
}, children: [new TextNode('text')]}));
assertDomMatches(htmlSoup.parse('< abc one two=3 four= five six =seven eight = "&quot;nine&quot;" ten=\'eleven\'>text< / abc >'), new HtmlTag({type: 'abc', attributes: {
	one: true,
	two: '3',
	four: 'five',
	six: 'seven',
	eight: '"nine"',
	ten: 'eleven'
}, children: [new TextNode('text')]}));
assertDomMatches(htmlSoup.parse('&amp;&abc &abc;&gt; def'), new TextNode('&&abc &abc;> def'))
assertDomMatches(htmlSoup.parse('<script> const abc = 1; console.log(2 < abc > 3); </script>'), new HtmlTag({type: 'script', attributes: {}, children: [
	new TextNode('const abc = 1; console.log(2 < abc > 3);')
]}))

//Basic selectors
let dom = htmlSoup.parse('<e checked /><c /><a><b id = "three"><c disabled="disabled"></c></b><c /></a><d /><c class = "one two"></c>');
let disabledC = new HtmlTag({type: 'c', attributes: {disabled: 'disabled'}, children: []}),
	emptyC1 = new HtmlTag({type: 'c', attributes: {}, children: []}),
	emptyC2 = new HtmlTag({type: 'c', attributes: {}, children: []}),
	lastC = new HtmlTag({type: 'c', attributes: {class: 'one two'}, children: []}),
	b = new HtmlTag({type: 'b', attributes: {id: 'three'}, children: [disabledC]}),
	e = new HtmlTag({type: 'e', attributes: {checked: true}, children: []});
assertDomMatches(htmlSoup.select(dom, 'c'), new Set([emptyC1, lastC, emptyC2, disabledC]));
for (let selector of ['*#three', '#three']) assertDomMatches(htmlSoup.select(dom, selector), new Set([b]));
for (let selector of ['c.one', '.one', 'c.two', 'c.one.two']) assertDomMatches(htmlSoup.select(dom, selector), new Set([lastC]));
//Composed selectors
for (let selector of ['a c', 'a   c']) assertDomMatches(htmlSoup.select(dom, selector), new Set([emptyC1, disabledC]));
for (let selector of ['a>*', 'a > *', 'a> *', 'a >*']) assertDomMatches(htmlSoup.select(dom, selector), new Set([b, emptyC1]));
assertDomMatches(htmlSoup.select(dom, '* + c'), new Set([emptyC1, lastC, emptyC2]));
assertDomMatches(htmlSoup.select(dom, 'b + c'), new Set([emptyC1]));
assertDomMatches(htmlSoup.select(dom, 'a + c'), new Set([]));
assertDomMatches(htmlSoup.select(dom, 'a ~ c'), new Set([lastC]));
assertDomMatches(htmlSoup.select(dom, 'c[disabled], c.one.two, div'), new Set([disabledC, lastC]));
//Pseudo-classes
assertDomMatches(htmlSoup.select(dom, ':checked'), new Set([e]));
assertDomMatches(htmlSoup.select(dom, ':disabled'), new Set([disabledC]));
assertDomMatches(htmlSoup.select(
	htmlSoup.parse('<a>abc</a><b></b><c><!--comment--></c><d><!--abc-->--></d><e>  <!--abc--> <!--def--> </e>'),
	':empty'
), new Set([
	new HtmlTag({type: 'b', attributes: {}, children: []}),
	new HtmlTag({type: 'c', attributes: {}, children: [new TextNode('<!--comment-->')]}),
	new HtmlTag({type: 'e', attributes: {}, children: [new TextNode('<!--abc--> <!--def-->')]})
]));
assertDomMatches(htmlSoup.select(dom, ':first-child'), new Set([e, b, disabledC]));
assertDomMatches(htmlSoup.select(dom, 'c:first-of-type'), new Set([emptyC1, emptyC2, disabledC]));
assertDomMatches(htmlSoup.select(dom, 'c:last-of-type'), new Set([lastC, emptyC1, disabledC]));
assertDomMatches(htmlSoup.select(dom, 'c:only-of-type'), new Set([emptyC2, disabledC]));
assertDomMatches(htmlSoup.select(htmlSoup.parse('<div></div><input type=radio name=one value=a><input type=radio name=one value=b><input type=radio name=two value=c><input type=radio name=two value=d checked><input type=checkbox indeterminate=yes><input type=checkbox><input type=password value=1234><progress max=20 value=10/><progress/><progress max=20/><progress value=10/>'), ':indeterminate'), new Set([
	new HtmlTag({type: 'input', attributes: {type: 'radio', name: 'one', value: 'a'}, children: []}),
	new HtmlTag({type: 'input', attributes: {type: 'radio', name: 'one', value: 'b'}, children: []}),
	new HtmlTag({type: 'input', attributes: {type: 'checkbox', indeterminate: 'yes'}, children: []}),
	new HtmlTag({type: 'progress', attributes: {}, children: []}),
	new HtmlTag({type: 'progress', attributes: {max: '20'}, children: []}),
	new HtmlTag({type: 'progress', attributes: {value: '10'}, children: []})
]));
assertDomMatches(htmlSoup.select(dom, ':root ~ :last-child'), new Set([lastC]));
assertDomMatches(htmlSoup.select(dom, 'a > :last-child'), new Set([emptyC1]));
assertDomMatches(htmlSoup.select(dom, ':only-child'), new Set([disabledC]));
let someRequired = htmlSoup.parse('<textarea required></textarea><textarea></textarea><input><input required><div></div>');
assertDomMatches(htmlSoup.select(someRequired, ':optional'), new Set([
	new HtmlTag({type: 'textarea', attributes: {}, children: []}),
	new HtmlTag({type: 'input', attributes: {}, children: []}),
	new HtmlTag({type: 'div', attributes: {}, children: []})
]));
assertDomMatches(htmlSoup.select(someRequired, ':required'), new Set([
	new HtmlTag({type: 'textarea', attributes: {required: true}, children: []}),
	new HtmlTag({type: 'input', attributes: {required: true}, children: []})
]));
assertDomMatches(htmlSoup.select(dom, 'b:root, c:root, d:root, e:root'), new Set([emptyC1, lastC, new HtmlTag({type: 'd', attributes: {}, children: []}), e]));
//Attributes
dom = htmlSoup.parse('<a one = two two = "three-four" six = "seven" /><a two = "threefour" five six="eight"/>');
let firstA = new HtmlTag({type: 'a', attributes: {one: 'two', two: 'three-four', six: 'seven'}, children: []}),
	secondA = new HtmlTag({type: 'a', attributes: {two: 'threefour', five: true, six: 'eight'}, children: []});
assertDomMatches([firstA, secondA], dom);
assertDomMatches(htmlSoup.select(dom, '[five]'), new Set([secondA]));
for (let selector of ['a[six=eight]', '[six=eight]', '[six="eight"]', 'a[two][six=eight]']) {
	assertDomMatches(htmlSoup.select(dom, selector), new Set([secondA]));
}
assertDomMatches(htmlSoup.select(dom, '[two~=four]'), new Set([firstA]));
assertDomMatches(htmlSoup.select(dom, '[two|=three]'), new Set([firstA]));
assertDomMatches(htmlSoup.select(dom, '[two^=three]'), new Set([firstA, secondA]));
assertDomMatches(htmlSoup.select(dom, '[two$=ur]'), new Set([firstA, secondA]));
assertDomMatches(htmlSoup.select(dom, '[one*=w]'), new Set([firstA]));
assertDomMatches(htmlSoup.select(dom, '[two*="e-f"]'), new Set([firstA]));
//Escaped characters in attributes
dom = htmlSoup.parse('<div abc=\'"\'></div><div abc = \'"\' def="]"></div><div def = "]"></div>');
let first = new HtmlTag({type: 'div', attributes: {abc: '"'}, children: []}),
	second = new HtmlTag({type: 'div', attributes: {abc: '"', def: ']'}, children: []}),
	third = new HtmlTag({type: 'div', attributes: {def: ']'}, children: []});
assertDomMatches([first, second, third], dom);
assertDomMatches(htmlSoup.select(dom, 'div'), new Set([first, second, third]));
assertDomMatches(htmlSoup.select(dom, 'div[abc="\\""]'), new Set([first, second]));
assertDomMatches(htmlSoup.select(dom, 'div[def="]"]'), new Set([second, third]));
assertDomMatches(htmlSoup.select(dom, 'div[def=\\]]'), new Set([second, third]));
assertDomMatches(htmlSoup.select(dom, 'div[def="]"][abc="\\""]'), new Set([second]));