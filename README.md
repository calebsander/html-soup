# html-soup
A Node.js package to do some basic HTML parsing and CSS selectors.

[![Build Status](https://travis-ci.org/calebsander/html-soup.svg?branch=master)](https://travis-ci.org/calebsander/html-soup)

## Usage
#### Parsing
`htmlSoup.parse(htmlString, trimText = true) -> DOM`
- `htmlString`: The HTML to parse (string or `Buffer`). If an `&` is used followed by an alphanumeric character or `#`, it will be assumed to start an HTML escape sequence. If a tag that is supposed to have a closing tag does not have one, it will be assumed to continue until a closing tag that doesn't close an inner element or the end of the document is reached. Closing tags will close the innermost open tag preceding them regardless of whether the types match.
- `trimText`: Whether to trim all text (removing leading or trailing whitespace) between HTML tags. If the trimmed text is empty, no text node will be created.
- DOM format: Either a single `TextNode` or `HtmlTag` or an array of instances of either class. `TextNode` has a single field, `text` containing the text inside. `HtmlTag` has the following fields:
	- `type`: The HTML tag type, e.g. `div`. If the document uses an uppercase tag, this field's value will be uppercased as well.
	- `attributes`: An `Object` mapping attribute names to string values if provided, or `true` if no value is provided. For example, `<input type = "checkbox" checked />` gives an `attributes` value of `{type: 'checkbox', checked: true}`. Attributes are automatically lower-cased.
	- `children`: An `Array` of child nodes. Each is either a `TextNode` or `HtmlTag`.
	- `parent`: The parent `HtmlTag`. On the root node, this field has the value `null`.

When navigating the DOM tree, you can use `htmlTag.child` to get the first child of a tag. `htmlTag.classes` will give a set of classes of the tag.

#### Selecting
`htmlSoup.select(dom, selectorString) -> Set<HtmlTag>`
- `dom`: DOM tree to search through (presumably an output of `htmlSoup.parse()`)
- `selectorString`: A CSS selector string specifying which elements to select. Allowed parts of the selector (can be combined):
	- `*`: select elements of any type
	- `tag`: select elements of type `tag` (case-insensitive)
	- `.class`: select elements of class `class`
	- `#id`: select elements of id `id`
	- `selector1 selector2`: select elements matching `selector2` that are descendants of elements matching `selector1`
	- `selector1 > selector2`: select elements matching `selector2` that are children of elements matching `selector1`
	- `selector1 + selector2`: select elements matching `selector2` that are siblings of and directly follow elements matching `selector1`
	- `selector1 ~ selector2`: select elements matching `selector2` that are siblings of and follow elements matching `selector1`
	- `selector1, selector2`: select elements matching either `selector1` or `selector2`
	- `[attr]`: select elements with attribute `attr` present
	- `[attr=val]` or `[attr="val"]`: select elements with attribute `attr` having the value `val`
	- `[attr~=val]` or `[attr~="val"]`: select elements with attribute `attr`'s value containing `val` with `val` preceded by a hypen, space, or at the start of the value and `val` followed by a hypen, space, or at the end of the value
	- `[attr|=val]` or `[attr|="val"]`: select elements with attribute `attr`'s value starting with `val` and followed by a hypen, space, or at the end of the value
	- `[attr^=val]` or `[attr^="val"]`: select elements with attribute `attr`'s value starting with `val`
	- `[attr$=val]` or `[attr$="val"]`: select elements with attribute `attr`'s value ending with `val`
	- `[attr*=val]` or `[attr*="val"]`: select elements with attribute `attr`'s value containing `val`
	- These [CSS pseudo-classes](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-classes) are also supported: `:checked`, `:disabled`, `:empty`, `:first-child`, `:first-of-type`, `:indeterminate`, `:last-child`, `:last-of-type`, `:only-child`, `:only-of-type`, `:optional`, `:required`, `:root`

## Examples
````javascript
let dom = htmlSoup.parse('<div id="one">Hi</div>');
/*
HtmlTag {
  type: 'div',
  attributes: { id: 'one' },
  parent:
   HtmlTag {
     type: null,
     attributes: {},
     parent: null,
     children: [ [Circular] ] },
  children: [ TextNode { text: 'Hi' } ] }
*/
let text = dom.child; //TextNode { text: 'Hi' }

let firstYellow = htmlSoup.select(htmlSoup.parse('<p>One</p><p class="red yellow">Two</p><p class="yellow">Three</p>'), 'p.yellow:first-of-type');
/*
[ HtmlTag {
    type: 'p',
    attributes: { class: 'red yellow' },
    parent: HtmlTag { type: null, attributes: {}, parent: null, children: [Object] },
    children: [ TextNode { text: 'Two' } ] } ]
*/

let classes = htmlSoup.parse('<div class="one two three"></div>').classes;
//Set { 'one', 'two', 'three' }
````