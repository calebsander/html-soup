import {strict as assert} from 'assert'
import * as htmlSoup from '../dist'
import * as parse from '../dist/parse'

const {TextNode, HtmlTag} = htmlSoup.parse

function makeHtmlTag(
	type: string,
	attributes: parse.Attributes = {},
	children: parse.Children = []
) {
	const tag = new HtmlTag({type, attributes, children, parent: null})
	for (const child of children) {
		if (child instanceof HtmlTag) (child as any).parent = tag
	}
	return tag
}
const makeRoot = (...tags: parse.Children) => makeHtmlTag('', {}, tags)

//Text
assert.deepEqual(htmlSoup.parse('abc'), new TextNode('abc'))
assert.deepEqual(htmlSoup.parse(' abc\n'), new TextNode('abc'))
assert.deepEqual(htmlSoup.parse(' abc\n', false), new TextNode(' abc\n'))
assert.deepEqual(htmlSoup.parse('abc&quot;def'), new TextNode('abc"def'))
assert.deepEqual(htmlSoup.parse('abc&;'), new TextNode('abc&;'))
assert.deepEqual(htmlSoup.parse('&#97;'), new TextNode('a'))
assert.deepEqual(htmlSoup.parse('abc&'), new TextNode('abc&'))
assert.deepEqual(htmlSoup.parse('abc <!--commented out-->\n'), new TextNode('abc <!--commented out-->'))
//HTML
assert.deepEqual(
	htmlSoup.parse('<abc> \r \n\t </abc>'),
	makeRoot(makeHtmlTag('abc')).child
)
assert.deepEqual(htmlSoup.parse('<abc />'), makeRoot(makeHtmlTag('abc')).child)
assert.deepEqual(
	htmlSoup.parse('<a /><b></b>'),
	makeRoot(makeHtmlTag('a'), makeHtmlTag('b')).children
)
assert.deepEqual(
	htmlSoup.parse('< br  >< br>< br>'),
	makeRoot(makeHtmlTag('br'), makeHtmlTag('br'), makeHtmlTag('br')).children
)
assert.deepEqual(
	htmlSoup.parse('<a><b>'),
	makeRoot(makeHtmlTag('a', {}, [makeHtmlTag('b')])).child
)
assert.deepEqual(
	htmlSoup.parse('\n\n<p> Some text </p>\n\n'),
	makeRoot(makeHtmlTag('p', {}, [new TextNode('Some text')])).child
)
assert.deepEqual(htmlSoup.parse('one<A><b><C /></b><d> </d></A><BR>two'),
	makeRoot(
		new TextNode('one'),
		makeHtmlTag('A', {}, [
			makeHtmlTag('b', {}, [makeHtmlTag('C')]),
			makeHtmlTag('d')
		]),
		makeHtmlTag('BR'),
		new TextNode('two')
	).children
)
assert.deepEqual(
	htmlSoup.parse(`
		<abc one two=3 four= five six =seven eight = "&quot;nine&quot;" ten=\'eleven\' >
			text
		</abc>
	`),
	makeRoot(
		makeHtmlTag('abc', {
			one: true,
			two: '3',
			four: 'five',
			six: 'seven',
			eight: '"nine"',
			ten: 'eleven'
		}, [new TextNode('text')])
	).child
)
assert.deepEqual(
	htmlSoup.parse(`
		< abc one two=3 four= five six =seven eight = "&quot;nine&quot;" ten=\'eleven\'>
			text
		< / abc >
	`),
	makeRoot(
		makeHtmlTag('abc', {
			one: true,
			two: '3',
			four: 'five',
			six: 'seven',
			eight: '"nine"',
			ten: 'eleven'
		}, [new TextNode('text')])
	).child
)
assert.deepEqual(
	htmlSoup.parse('&amp;&abc &abc;&gt; def'),
	new TextNode('&&abc &abc;> def')
)
assert.deepEqual(
	htmlSoup.parse('<script> const abc = 1; console.log(2 < abc > 3); </script>'),
	makeRoot(makeHtmlTag('script', {}, [
		new TextNode('const abc = 1; console.log(2 < abc > 3);')
	])).child
)

//Basic selectors
const dom = htmlSoup.parse(`
	<e checked />
	<c />
	<a>
		<b id = "three">
			<c disabled="disabled"></c>
		</b>
		<c />
	</a>
	<d />
	<c class = "one two"></c>
`)
const disabledC = makeHtmlTag('c', {disabled: 'disabled'}),
	emptyC1 = makeHtmlTag('c'),
	emptyC2 = makeHtmlTag('c'),
	lastC = makeHtmlTag('c', {class: 'one two'}),
	b = makeHtmlTag('b', {id: 'three'}, [disabledC]),
	d = makeHtmlTag('d'),
	e = makeHtmlTag('e', {checked: true})
makeRoot(e, emptyC1, makeHtmlTag('a', {}, [b, emptyC2]), d, lastC)
assert.deepEqual(
	htmlSoup.select(dom, 'c'),
	new Set([emptyC1, lastC, emptyC2, disabledC])
)
for (const selector of ['*#three', '#three']) {
	assert.deepEqual(htmlSoup.select(dom, selector), new Set([b]))
}
for (const selector of ['c.one', '.one', 'c.two', 'c.one.two']) {
	assert.deepEqual(htmlSoup.select(dom, selector), new Set([lastC]))
}
//Composed selectors
for (const selector of ['a c', 'a   c']) {
	assert.deepEqual(htmlSoup.select(dom, selector), new Set([emptyC2, disabledC]))
}
for (const selector of ['a>*', 'a > *', 'a> *', 'a >*']) {
	assert.deepEqual(htmlSoup.select(dom, selector), new Set([b, emptyC2]))
}
assert.deepEqual(htmlSoup.select(dom, '* + c'), new Set([emptyC1, lastC, emptyC2]))
assert.deepEqual(htmlSoup.select(dom, 'b + c'), new Set([emptyC2]))
assert.deepEqual(htmlSoup.select(dom, 'a + c'), new Set())
assert.deepEqual(htmlSoup.select(dom, 'a ~ c'), new Set([lastC]))
assert.deepEqual(
	htmlSoup.select(dom, 'c[disabled], c.one.two, div'),
	new Set([disabledC, lastC])
)
//Pseudo-classes
assert.deepEqual(htmlSoup.select(dom, ':checked'), new Set([e]))
assert.deepEqual(htmlSoup.select(dom, ':disabled'), new Set([disabledC]))
{
	const b = makeHtmlTag('b'),
		c = makeHtmlTag('c', {}, [new TextNode('<!--comment-->')]),
		e = makeHtmlTag('e', {}, [new TextNode('<!--abc--> <!--def-->')])
	makeRoot(
		makeHtmlTag('a', {}, [new TextNode('abc')]),
		b,
		c,
		makeHtmlTag('d', {}, [new TextNode('<!--abc-->-->')]),
		e
	)
	assert.deepEqual(htmlSoup.select(
		htmlSoup.parse(`
			<a>abc</a>
			<b></b>
			<c><!--comment--></c>
			<d><!--abc-->--></d>
			<e>  <!--abc--> <!--def--> </e>
		`),
		':empty'
	), new Set([b, c, e]))
}
assert.deepEqual(htmlSoup.select(dom, ':first-child'), new Set([e, b, disabledC]))
assert.deepEqual(
	htmlSoup.select(dom, 'c:first-of-type'),
	new Set([emptyC1, emptyC2, disabledC])
)
assert.deepEqual(
	htmlSoup.select(dom, 'c:last-of-type'),
	new Set([lastC, emptyC2, disabledC])
)
assert.deepEqual(
	htmlSoup.select(dom, 'c:only-of-type'),
	new Set([emptyC2, disabledC])
)
{
	const a = makeHtmlTag('input', {type: 'radio', name: 'one', value: 'a'}),
		b = makeHtmlTag('input', {type: 'radio', name: 'one', value: 'b'}),
		indeterminateCheckbox = makeHtmlTag('input', {type: 'checkbox', indeterminate: 'yes'}),
		emptyProgress = makeHtmlTag('progress'),
		progressMax = makeHtmlTag('progress', {max: '20'}),
		progressValue = makeHtmlTag('progress', {value: '10'})
	makeRoot(
		makeHtmlTag('div'),
		a,
		b,
		makeHtmlTag('input', {type: 'radio', name: 'two', value: 'c'}),
		makeHtmlTag('input', {type: 'radio', name: 'two', value: 'd', checked: true}),
		indeterminateCheckbox,
		makeHtmlTag('input', {type: 'checkbox'}),
		makeHtmlTag('input', {type: 'password', value: '1234'}),
		makeHtmlTag('progress', {max: '20', value: '10'}),
		emptyProgress,
		progressMax,
		progressValue
	)
	assert.deepEqual(htmlSoup.select(
		htmlSoup.parse(`
			<div></div>
			<input type=radio name=one value=a>
			<input type=radio name=one value=b>
			<input type=radio name=two value=c>
			<input type=radio name=two value=d checked>
			<input type=checkbox indeterminate=yes>
			<input type=checkbox>
			<input type=password value=1234>
			<progress max=20 value=10 />
			<progress />
			<progress max=20 />
			<progress value=10 />
		`),
		':indeterminate'
	), new Set([
		a,
		b,
		indeterminateCheckbox,
		emptyProgress,
		progressMax,
		progressValue
	]))
}
assert.deepEqual(htmlSoup.select(dom, ':root ~ :last-child'), new Set([lastC]))
assert.deepEqual(htmlSoup.select(dom, 'a > :last-child'), new Set([emptyC2]))
assert.deepEqual(htmlSoup.select(dom, ':only-child'), new Set([disabledC]))
{
	const dom = htmlSoup.parse(`
		<textarea required></textarea>
		<textarea></textarea>
		<input>
		<input required>
		<div></div>
	`)
	const textRequired = makeHtmlTag('textarea', {required: true}),
		textOptional = makeHtmlTag('textarea'),
		inputOptional = makeHtmlTag('input'),
		inputRequired = makeHtmlTag('input', {required: true}),
		div = makeHtmlTag('div')
	makeRoot(textRequired, textOptional, inputOptional, inputRequired, div)
	assert.deepEqual(
		htmlSoup.select(dom, ':optional'),
		new Set([textOptional, inputOptional, div])
	)
	assert.deepEqual(
		htmlSoup.select(dom, ':required'),
		new Set([textRequired, inputRequired])
	)
}
assert.deepEqual(
	htmlSoup.select(dom, 'b:root, c:root, d:root, e:root'),
	new Set([emptyC1, lastC, d, e])
)
//Nth selectors
{
	const dom = htmlSoup.parse(`
		<root>
			<a one />
			<b one />
			<a two />
			<c one />
			<c two />
			<a three/>
		</root>
	`)
	const aOne = makeHtmlTag('a', {one: true}),
		bOne = makeHtmlTag('b', {one: true}),
		aTwo = makeHtmlTag('a', {two: true}),
		cOne = makeHtmlTag('c', {one: true}),
		cTwo = makeHtmlTag('c', {two: true}),
		aThree = makeHtmlTag('a', {three: true})
	makeRoot(makeHtmlTag('root', {}, [aOne, bOne, aTwo, cOne, cTwo, aThree]))
	assert.deepEqual(htmlSoup.select(dom, 'root > :nth-child(5)'), new Set([cTwo]))
	assert.deepEqual(
		htmlSoup.select(dom, 'root > :nth-child(3n)'),
		new Set([aTwo, aThree])
	)
	assert.deepEqual(htmlSoup.select(dom, 'root > :nth-child(0n+3)'), new Set([aTwo]))
	assert.deepEqual(
		htmlSoup.select(dom, 'root > :nth-child(n+4)'),
		new Set([cOne, cTwo, aThree])
	)
	assert.deepEqual(
		htmlSoup.select(dom, 'root > :nth-child(-n+2)'),
		new Set([aOne, bOne])
	)
	assert.deepEqual(
		htmlSoup.select(dom, 'root > :nth-child(3n-100)'),
		new Set([bOne, cTwo])
	)
	assert.deepEqual(
		htmlSoup.select(dom, 'root > :nth-child(n+2):nth-child(-n+4)'),
		new Set([bOne, aTwo, cOne])
	)
	assert.deepEqual(
		htmlSoup.select(dom, 'root > :nth-child(even)'),
		new Set([bOne, cOne, aThree])
	)
	assert.deepEqual(
		htmlSoup.select(dom, 'root > :nth-child(odd)'),
		new Set([aOne, aTwo, cTwo])
	)
	assert.deepEqual(
		htmlSoup.select(dom, 'root > :nth-last-child(2n+3)'),
		new Set([bOne, cOne])
	)
	assert.deepEqual(
		htmlSoup.select(dom, 'root > a:nth-of-type(odd)'),
		new Set([aOne, aThree])
	)
	assert.deepEqual(
		htmlSoup.select(dom, 'root > c:nth-last-of-type(-3n+8)'),
		new Set([cOne])
	)
}
//Attributes
	{
	const dom = htmlSoup.parse(`
		<a one = two two = "three-four" six = "seven" />
		<a two = "threefour" five six="eight"/>
	`)
	const first = makeHtmlTag('a', {one: 'two', two: 'three-four', six: 'seven'}),
		second = makeHtmlTag('a', {two: 'threefour', five: true, six: 'eight'})
	makeRoot(first, second)
	assert.deepEqual(dom, [first, second])
	assert.deepEqual(htmlSoup.select(dom, '[five]'), new Set([second]))
	for (const selector of [
		'a[six=eight]', '[six=eight]', '[six="eight"]', 'a[two][six=eight]'
	]) {
		assert.deepEqual(htmlSoup.select(dom, selector), new Set([second]))
	}
	assert.deepEqual(htmlSoup.select(dom, '[two~=four]'), new Set([first]))
	assert.deepEqual(htmlSoup.select(dom, '[two|=three]'), new Set([first]))
	assert.deepEqual(htmlSoup.select(dom, '[two^=three]'), new Set([first, second]))
	assert.deepEqual(htmlSoup.select(dom, '[two$=ur]'), new Set([first, second]))
	assert.deepEqual(htmlSoup.select(dom, '[one*=w]'), new Set([first]))
	assert.deepEqual(htmlSoup.select(dom, '[two*="e-f"]'), new Set([first]))
}
//Escaped characters in attributes
{
	const dom = htmlSoup.parse(`
		<div abc=\'"\'></div>
		<div abc = \'"\' def="]"></div>
		<div def = "]"></div>
	`)
	const first = makeHtmlTag('div', {abc: '"'}),
		second = makeHtmlTag('div', {abc: '"', def: ']'}),
		third = makeHtmlTag('div', {def: ']'})
	makeRoot(first, second, third)
	assert.deepEqual(dom, [first, second, third])
	assert.deepEqual(htmlSoup.select(dom, 'div'), new Set([first, second, third]))
	assert.deepEqual(htmlSoup.select(dom, 'div[abc="\\""]'), new Set([first, second]))
	assert.deepEqual(htmlSoup.select(dom, 'div[def="]"]'), new Set([second, third]))
	assert.deepEqual(htmlSoup.select(dom, 'div[def=\\]]'), new Set([second, third]))
	assert.deepEqual(htmlSoup.select(dom, 'div[def="]"][abc="\\""]'), new Set([second]))
}

// Computed attributes
{
	const dom = htmlSoup.parse(`
		<div
			id="user"
			data-id="1234567890"
			data-user="johndoe"
			data-date-of-birth
		>John Doe</div>
	`) as parse.HtmlTag
	assert.deepEqual(dom.dataset, {id: '1234567890', user: 'johndoe', dateOfBirth: ''})
	assert.deepEqual((htmlSoup.parse('<br>') as parse.HtmlTag).dataset, {})
}