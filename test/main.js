const assert = require(__dirname + '/assert.js');
const htmlSoup = require(__dirname + '/../index.js');

const {TextNode, HtmlTag} = htmlSoup.parse;
function assertDomMatches(actual, expected) {
	if (expected.constructor === Array) {
		assert.instanceOf(actual, Array);
		assert.equal(actual.length, expected.length);
		for (let i = 0; i < expected.length; i++) assertDomMatches(actual[i], expected[i]);
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

//Basic selectors
let dom = htmlSoup.parse('<e checked /><c /><a><b id = "three"><c disabled="disabled"></c></b><c /></a><d /><c class = "one two"></c>');
let disabledC = new HtmlTag({type: 'c', attributes: {disabled: 'disabled'}, children: []}),
	emptyC = new HtmlTag({type: 'c', attributes: {}, children: []}),
	lastC = new HtmlTag({type: 'c', attributes: {class: 'one two'}, children: []}),
	b = new HtmlTag({type: 'b', attributes: {id: 'three'}, children: [disabledC]}),
	e = new HtmlTag({type: 'e', attributes: {checked: true}, children: []});
assertDomMatches(htmlSoup.select(dom, 'c'), [emptyC, lastC, emptyC, disabledC]);
for (let selector of ['*#three', '#three']) assertDomMatches(htmlSoup.select(dom, selector), [b]);
for (let selector of ['c.one', '.one', 'c.two', 'c.one.two']) assertDomMatches(htmlSoup.select(dom, selector), [lastC]);
//Composed selectors
for (let selector of ['a c', 'a   c']) assertDomMatches(htmlSoup.select(dom, selector), [emptyC, disabledC]);
for (let selector of ['a>*', 'a > *', 'a> *', 'a >*']) assertDomMatches(htmlSoup.select(dom, selector), [b, emptyC]);
assertDomMatches(htmlSoup.select(dom, '* + c'), [emptyC, lastC, emptyC]);
assertDomMatches(htmlSoup.select(dom, 'b + c'), [emptyC]);
assertDomMatches(htmlSoup.select(dom, 'a + c'), []);
assertDomMatches(htmlSoup.select(dom, 'a ~ c'), [lastC]);
assertDomMatches(htmlSoup.select(dom, 'c[disabled], c.one.two, div'), [disabledC, lastC]);
//Pseudo-classes
assertDomMatches(htmlSoup.select(dom, ':checked'), [e]);
assertDomMatches(htmlSoup.select(dom, ':disabled'), [disabledC]);
assertDomMatches(htmlSoup.select(htmlSoup.parse('<a>abc</a><b></b><c><!--comment--></c><d><!--abc-->--></d>'), ':empty'), [
	new HtmlTag({type: 'b', attributes: {}, children: []}),
	new HtmlTag({type: 'c', attributes: {}, children: [new TextNode('<!--comment-->')]})
]);
assertDomMatches(htmlSoup.select(dom, ':first-child'), [e, b, disabledC]);
assertDomMatches(htmlSoup.select(dom, 'c:first-of-type'), [emptyC, emptyC, disabledC]);
assertDomMatches(htmlSoup.select(dom, 'c:last-of-type'), [lastC, emptyC, disabledC]);
assertDomMatches(htmlSoup.select(dom, 'c:only-of-type'), [emptyC, disabledC]);
assertDomMatches(htmlSoup.select(htmlSoup.parse('<div></div><input type=radio name=one value=a><input type=radio name=one value=b><input type=radio name=two value=c><input type=radio name=two value=d checked><input type=checkbox indeterminate=yes><input type=checkbox><input type=password value=1234><progress max=20 value=10/><progress/><progress max=20/><progress value=10/>'), ':indeterminate'), [
	new HtmlTag({type: 'input', attributes: {type: 'radio', name: 'one', value: 'a'}, children: []}),
	new HtmlTag({type: 'input', attributes: {type: 'radio', name: 'one', value: 'b'}, children: []}),
	new HtmlTag({type: 'input', attributes: {type: 'checkbox', indeterminate: 'yes'}, children: []}),
	new HtmlTag({type: 'progress', attributes: {}, children: []}),
	new HtmlTag({type: 'progress', attributes: {max: '20'}, children: []}),
	new HtmlTag({type: 'progress', attributes: {value: '10'}, children: []})
]);
//assertDomMatches(htmlSoup.select(dom, ':root ~ :last-child'), [lastC]); see #1 on GitHub
assertDomMatches(htmlSoup.select(dom, 'a > :last-child'), [emptyC]);
assertDomMatches(htmlSoup.select(dom, ':only-child'), [disabledC]);
let someRequired = htmlSoup.parse('<textarea required></textarea><textarea></textarea><input><input required><div></div>');
assertDomMatches(htmlSoup.select(someRequired, ':optional'), [
	new HtmlTag({type: 'textarea', attributes: {}, children: []}),
	new HtmlTag({type: 'input', attributes: {}, children: []}),
	new HtmlTag({type: 'div', attributes: {}, children: []})
]);
assertDomMatches(htmlSoup.select(someRequired, ':required'), [
	new HtmlTag({type: 'textarea', attributes: {required: true}, children: []}),
	new HtmlTag({type: 'input', attributes: {required: true}, children: []})
]);
assertDomMatches(htmlSoup.select(dom, 'b:root, c:root, d:root, e:root'), [emptyC, lastC, new HtmlTag({type: 'd', attributes: {}, children: []}), e]);
//Attributes
dom = htmlSoup.parse('<a one = two two = "three-four" six = "seven" /><a two = "threefour" five six="eight"/>');
let firstA = new HtmlTag({type: 'a', attributes: {one: 'two', two: 'three-four', six: 'seven'}, children: []}),
	secondA = new HtmlTag({type: 'a', attributes: {two: 'threefour', five: true, six: 'eight'}, children: []});
assertDomMatches([firstA, secondA], dom);
assertDomMatches(htmlSoup.select(dom, '[five]'), [secondA]);
for (let selector of ['a[six=eight]', '[six=eight]', '[six="eight"]', 'a[two][six=eight]']) assertDomMatches(htmlSoup.select(dom, selector), [secondA]);
assertDomMatches(htmlSoup.select(dom, '[two~=four]'), [firstA]);
assertDomMatches(htmlSoup.select(dom, '[two|=three]'), [firstA]);
assertDomMatches(htmlSoup.select(dom, '[two^=three]'), [firstA, secondA]);
assertDomMatches(htmlSoup.select(dom, '[two$=ur]'), [firstA, secondA]);
assertDomMatches(htmlSoup.select(dom, '[one*=w]'), [firstA]);
assertDomMatches(htmlSoup.select(dom, '[two*="e-f"]'), [firstA]);