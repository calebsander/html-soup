const htmlDecode = require(__dirname + '/html-decode.js');

class TextNode {
	constructor(text) {
		this.text = text;
	}
}
class HtmlTag {
	constructor({type, attributes, children, parent}) {
		this.type = type;
		this.attributes = attributes;
		if (children) this.children = children;
		this.parent = parent;
	}
	_setChildren(children) {
		this.children = children;
	}
	get child() { //if you know there is only one child
		return this.children[0];
	}
	get classes() {
		if (!this.classSet) this.classSet = this.attributes.class ? new Set(this.attributes.class.split(' ')) : new Set;
		return this.classSet;
	}
}

class ReadingState {
	constructor(ignoreWhitespace) {
		this.ignoreWhitespace = ignoreWhitespace;
	}
}
const
	READING_TEXT = new ReadingState(false),
	READING_ESCAPE = new ReadingState(false),
	IN_TAG = new ReadingState(false),
	READING_ATTRIBUTE_NAME = new ReadingState(true),
	LOOKING_FOR_VALUE_START = new ReadingState(true),
	READING_ATTRIBUTE_VALUE = new ReadingState(false),
	READING_ESCAPE_ATTRIBUTE = new ReadingState(false),
	DONE = null;
const WHITESPACE = /^\s$/;
const AMPERSAND_CODE_CHAR = /^[0-9a-zA-Z#]$/;
const SINGLETON_TAGS = new Set()
	.add('area')
	.add('base')
	.add('br')
	.add('col')
	.add('command')
	.add('embed')
	.add('hr')
	.add('img')
	.add('input')
	.add('link')
	.add('meta')
	.add('param')
	.add('source');

function readChildren(string, index, parent, trimText) {
	const originalIndex = index;
	const children = [];
	let state = READING_TEXT;
	let text = '', escapeCode, name, closingTag, attributes, attributeName, selfClosing, valueEndCharacter, value;
	let inComment = false;
	for (; state; index++) {
		if (index >= string.length) break;
		const char = string[index];
		const whitespace = WHITESPACE.test(char);
		if (state.ignoreWhitespace && whitespace) continue;
		switch (state) {
			case READING_TEXT:
				if (char === '<' && !inComment) {
					if (string.substring(index + 1, index + 4) === '!--') {
						text += '<!--';
						inComment = true;
						index += 3;
					}
					else {
						if (trimText) text = text.trim();
						if (text) children.push(new TextNode(text));
						state = IN_TAG;
						name = '';
						closingTag = false;
						attributes = {};
						selfClosing = false;
					}
				}
				else if (char === '&' && AMPERSAND_CODE_CHAR.test(string[index + 1])) {
					state = READING_ESCAPE;
					escapeCode = '';
				}
				else if (inComment && string.substring(index, index + 3) === '-->') {
					text += '-->';
					inComment = false;
					index += 2;
				}
				else text += char;
				break;
			case READING_ESCAPE:
			case READING_ESCAPE_ATTRIBUTE:
				if (char === ';') {
					let resolvedChar;
					if (escapeCode[0] === '#') {
						resolvedChar = String.fromCharCode(Number(escapeCode.substring(1)));
					}
					else {
						resolvedChar = htmlDecode[escapeCode];
						if (resolvedChar === undefined) throw new Error("Couldn't decode &" + escapeCode + ';');
					}
					if (state === READING_ESCAPE) {
						text += resolvedChar;
						state = READING_TEXT;
					}
					else {
						value += resolvedChar;
						state = READING_ATTRIBUTE_VALUE;
					}
				}
				else escapeCode += char;
				break;
			case IN_TAG:
				if (whitespace) {
					if (name) {
						state = READING_ATTRIBUTE_NAME;
						attributeName = '';
					}
				}
				else if (char === '/') {
					if (name) selfClosing = true;
					else closingTag = true;
				}
				else if (char === '>') {
					if (closingTag) state = null; //we have come to the end of all that had to be read
					else {
						if (SINGLETON_TAGS.has(name.toLowerCase())) selfClosing = true;
						if (selfClosing) {
							children.push(new HtmlTag({type: name, attributes, children: [], parent}));
							text = '';
							state = READING_TEXT;
						}
						else {
							const tag = new HtmlTag({type: name, attributes, parent});
							const tagChildren = readChildren(string, index + 1, tag, trimText);
							tag._setChildren(tagChildren.children);
							children.push(tag);
							index += tagChildren.length;
							text = '';
							state = READING_TEXT;
						}
					}
				}
				else {
					if (!closingTag) name += char; //name is not necessary for a closing tag
				}
				break;
			case READING_ATTRIBUTE_NAME:
				const tagChar = char === '/' || char === '>';
				if (char === '=') state = LOOKING_FOR_VALUE_START;
				else if (tagChar) {
					if (attributeName) {
						attributes[attributeName.toLowerCase()] = true;
						attributeName = '';
					}
					if (tagChar) {
						index--;
						state = IN_TAG;
					}
				}
				else {
					if (WHITESPACE.test(string[index - 1]) && attributeName) {
						attributes[attributeName.toLowerCase()] = true;
						attributeName = '';
					}
					attributeName += char;
				}
				break;
			case LOOKING_FOR_VALUE_START:
				if (char === "'" || char === '"') valueEndCharacter = char;
				else {
					valueEndCharacter = null;
					index--;
				}
				state = READING_ATTRIBUTE_VALUE;
				value = '';
				break;
			case READING_ATTRIBUTE_VALUE:
				if (char === valueEndCharacter || (valueEndCharacter === null && whitespace)) {
					attributes[attributeName.toLowerCase()] = value;
					state = READING_ATTRIBUTE_NAME;
					attributeName = '';
				}
				else if (valueEndCharacter === null && (char === '/' || char === '>')) {
					attributes[attributeName.toLowerCase()] = value;
					index--;
					state = IN_TAG;
				}
				else {
					if (char === '&' && AMPERSAND_CODE_CHAR.test(string[index + 1])) {
						state = READING_ESCAPE_ATTRIBUTE;
						escapeCode = '';
					}
					else value += char;
				}
				break;
			default:
				throw new Error('Invalid state');
		}
	}
	if (state === READING_TEXT) {
		if (trimText) text = text.trim();
		if (text) children.push(new TextNode(text));
	}
	return {children, length: index - originalIndex};
}

module.exports = (string, trimText = true) => {
	//Assumes a correctly formatted HTML string
	if (string && string.constructor === Buffer) string = string.toString();
	const root = new HtmlTag({type: null, attributes: {}, parent: null});
	root.children = readChildren(string, 0, root, trimText).children;
	if (root.children.length === 1) return root.children[0];
	else return root.children;
};
module.exports.HtmlTag = HtmlTag;
module.exports.TextNode = TextNode;