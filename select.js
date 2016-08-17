const parse = require(__dirname + '/parse.js');

const HTML_COMMENT_END = '-->';
function regexEscape(s) {
	return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

const SEPARATOR_CHARS = new Set().add(',').add(' ').add('>').add('+').add('~');
function isSeparator(char) {
	return SEPARATOR_CHARS.has(char);
}

class SelectorReadingState {}
const
	TAG = new SelectorReadingState(),
	CLASS = new SelectorReadingState(),
	ID = new SelectorReadingState(),
	ATTRIBUTES = new SelectorReadingState(),
	PSEUDOS = new SelectorReadingState();

const EXISTING = true, EQUALING = '=', CONTAINING_WHOLE_WORD = '~=', STARTING_WHOLE_WORD = '|=', STARTING = '^=', ENDING = '$=', CONTAINING = '*=';
class AttributeMatch {
	constructor(attribute, matchType, value) {
		this.attribute = attribute;
		this.matchType = matchType;
		if (value !== undefined) this.value = value;
	}
}
function stripQuotes(string) {
	if (string.length !== 1 && string[0] === '"' && string[string.length - 1] === '"') return string.slice(1, -1);
	else return string;
}

class Selector {
	findMatches(dom, recursive, matchSet) {
		throw new Error('Not implemented for ' + this.constructor.name);
	}
}
class SingleSelector extends Selector { //selector that doesn't relate different selectors (e.g. div.hide#one:hover but not div > ul.abc)
	constructor(selectorString) {
		super();
		this.classes = [];
		this.attributes = [];
		this.pseudos = [];
		const saveSegment = () => {
			switch (state) {
				case TAG:
					if (!name || name === '*') this.tagName = '*';
					else this.tagName = name;
					break;
				case CLASS:
					this.classes.push(name);
					break;
				case ID:
					this.id = name;
					break;
				case ATTRIBUTES:
					let index;
					if ((index = name.indexOf(CONTAINING_WHOLE_WORD)) != -1) {
						this.attributes.push(new AttributeMatch(
							name.substring(0, index),
							CONTAINING_WHOLE_WORD,
							stripQuotes(name.substring(index + CONTAINING_WHOLE_WORD.length))
						));
					}
					else if ((index = name.indexOf(STARTING)) != -1) {
						this.attributes.push(new AttributeMatch(
							name.substring(0, index),
							STARTING,
							stripQuotes(name.substring(index + STARTING.length))
						));
					}
					else if ((index = name.indexOf(STARTING_WHOLE_WORD)) != -1) {
						this.attributes.push(new AttributeMatch(
							name.substring(0, index),
							STARTING_WHOLE_WORD,
							stripQuotes(name.substring(index + STARTING_WHOLE_WORD.length))
						));
					}
					else if ((index = name.indexOf(ENDING)) != -1) {
						this.attributes.push(new AttributeMatch(
							name.substring(0, index),
							ENDING,
							stripQuotes(name.substring(index + ENDING.length))
						));
					}
					else if ((index = name.indexOf(CONTAINING)) != -1) {
						this.attributes.push(new AttributeMatch(
							name.substring(0, index),
							CONTAINING,
							stripQuotes(name.substring(index + CONTAINING.length))
						));
					}
					else if ((index = name.indexOf(EQUALING)) != -1) {
						this.attributes.push(new AttributeMatch(
							name.substring(0, index),
							EQUALING,
							stripQuotes(name.substring(index + EQUALING.length))
						));
					}
					else this.attributes.push(new AttributeMatch(name, EXISTING));
					break;
				case PSEUDOS: //todo: :not(), :nth-*()
					this.pseudos.push(name);
			}
		};
		let state = TAG;
		let name = '';
		let inQuotes = false;
		for (let i = 0; i < selectorString.length; i++) { //todo: [abc="def]"] probably doesn't work
			const char = selectorString[i];
			if (char === '\\') {
				name += selectorString[i + 1];
				i++;
				continue;
			}
			else if (char === '"') inQuotes = !inQuotes;
			else if (inQuotes) {
				name += char;
				continue;
			}
			let segmentEnd = true;
			let newState;
			if (char === '.') newState = CLASS;
			else if (char === '#') newState = ID;
			else if (char === '[') newState = ATTRIBUTES;
			else if (char === ']') newState = null;
			else if (char === ':') newState = PSEUDOS;
			else {
				segmentEnd = false;
				name += char;
			}
			if (segmentEnd) {
				saveSegment();
				state = newState;
				name = '';
			}
		}
		saveSegment();
	}
	findMatches(dom, recursive, matchSet) {
		if (recursive) {
			this.findMatches(dom, false, matchSet);
			for (const element of dom) {
				if (element.constructor === parse.TextNode) continue;
				this.findMatches(element.children, true, matchSet);
			}
		}
		else {
			for (const element of dom) {
				if (element.constructor === parse.TextNode) continue;
				if (element.type === null || !(this.tagName === '*' || element.type.toLowerCase() === this.tagName)) continue;
				let isMatch = true;
				for (const className of this.classes) {
					if (!element.classes.has(className)) {
						isMatch = false;
						break;
					}
				}
				if (!isMatch) continue;
				if (this.id !== undefined && element.attributes.id !== this.id) continue;
				for (const attribute of this.attributes) {
					switch (attribute.matchType) {
						case EXISTING:
							if (element.attributes[attribute.attribute] === undefined) isMatch = false;
							break;
						case EQUALING:
							if (element.attributes[attribute.attribute] !== attribute.value) isMatch = false;
							break;
						case CONTAINING_WHOLE_WORD:
							const containingMatch = new RegExp('(?:^|\\s|-)' + regexEscape(attribute.value) + '(?:\\s|-|$)');
							if (!containingMatch.test(element.attributes[attribute.attribute])) isMatch = false;
							break;
						case STARTING_WHOLE_WORD:
							const startingMatch = new RegExp('^' + regexEscape(attribute.value) + '(?:\\s|-|$)');
							if (!startingMatch.test(element.attributes[attribute.attribute])) isMatch = false;
							break;
						case STARTING:
							const startMatch = new RegExp('^' + regexEscape(attribute.value));
							if (!startMatch.test(element.attributes[attribute.attribute])) isMatch = false;
							break;
						case ENDING:
							const endingMatch = new RegExp(regexEscape(attribute.value) + '$');
							if (!endingMatch.test(element.attributes[attribute.attribute])) isMatch = false;
							break;
						case CONTAINING:
							if (!(
								element.attributes[attribute.attribute] &&
								element.attributes[attribute.attribute].constructor === String &&
								element.attributes[attribute.attribute].indexOf(attribute.value) != -1
							)) isMatch = false;
					}
					if (!isMatch) break;
				}
				if (!isMatch) continue;
				for (let i = 0; i < this.pseudos.length; i++) {
					const pseudo = this.pseudos[i];
					switch (pseudo) {
						case 'checked':
							if (element.attributes.checked === undefined) isMatch = false;
							break;
						case 'disabled':
							if (element.attributes.disabled === undefined) isMatch = false;
							break;
						case 'empty':
							for (const child of element.children) {
								if (!(
									child.constructor === parse.TextNode &&
									child.text.startsWith('<!--') &&
									child.text.indexOf(HTML_COMMENT_END) === child.text.length - HTML_COMMENT_END.length
								)) {
									isMatch = false;
									break;
								}
							}
							break;
						case 'first-child':
							if (element.parent.children.indexOf(element) !== 0) isMatch = false;
							break;
						case 'first-of-type':
						case 'last-of-type':
						case 'only-of-type':
							this.pseudos.splice(i, 1);
							const allMatches = new Set;
							this.findMatches(dom, false, allMatches);
							if (pseudo === 'first-of-type') {
								if (!(allMatches.size > 0 && element === allMatches.values().next().value)) isMatch = false;
							}
							else if (pseudo === 'last-of-type') {
								let lastMatch = undefined;
								for (lastMatch of allMatches);
								if (element !== lastMatch) isMatch = false;
							}
							else {
								if (!(allMatches.size === 1 && element === allMatches.values().next().value)) isMatch = false;
							}
							this.pseudos.splice(i, 0, pseudo);
							break;
						case 'indeterminate':
							switch (element.type) {
								case 'input':
									switch (element.attributes.type) {
										case 'checkbox':
											if (element.attributes.indeterminate === undefined) isMatch = false;
											break;
										case 'radio':
											const thisName = element.attributes.name;
											let oneChecked = false;
											for (const sibling of element.parent.children) {
												if (
													sibling.type === 'input' &&
													sibling.attributes.type === 'radio' &&
													sibling.attributes.name === thisName &&
													sibling.attributes.checked !== undefined
												) {
													oneChecked = true;
													break;
												}
											}
											if (oneChecked) isMatch = false;
											break;
										default:
											isMatch = false;
									}
									break;
								case 'progress':
									if (element.attributes.value && element.attributes.max) isMatch = false;
									break;
								default:
									isMatch = false;
							}
							break;
						case 'last-child':
							const siblings = element.parent.children;
							if (siblings.indexOf(element) !== siblings.length - 1) isMatch = false;
							break;
						case 'only-child':
							if (element.parent.children.length !== 1) isMatch = false;
							break;
						case 'optional':
							if (element.attributes.required !== undefined) isMatch = false;
							break;
						case 'required':
							if (element.attributes.required === undefined) isMatch = false;
							break;
						case 'root':
							if (!(element.parent && element.parent.parent === null)) isMatch = false;
					}
					if (!isMatch) break;
				}
				if (!isMatch) continue;
				matchSet.add(element);
			}
		}
	}
}
class CommaSelector extends Selector {
	constructor(selectors) {
		super();
		this.selectors = selectors;
	}
	findMatches(dom, recursive, matchSet) {
		for (const selector of this.selectors) selector.findMatches(dom, recursive, matchSet);
	}
}
class DescendantSelector extends Selector {
	constructor(ancestor, descendant) {
		super();
		this.ancestor = ancestor;
		this.descendant = descendant;
	}
	findMatches(dom, recursive, matchSet) {
		const ancestorMatches = new Set;
		this.ancestor.findMatches(dom, recursive, ancestorMatches);
		for (const ancestorMatch of ancestorMatches) {
			this.descendant.findMatches(ancestorMatch.children, true, matchSet);
		}
	}
}
class DirectDescendantSelector extends Selector {
	constructor(parent, child) {
		super();
		this.parent = parent;
		this.child = child;
	}
	findMatches(dom, recursive, matchSet) {
		const parentMatches = new Set;
		this.parent.findMatches(dom, recursive, parentMatches);
		for (const parentMatch of parentMatches) {
			this.child.findMatches(parentMatch.children, false, matchSet);
		}
	}
}
class AdjacentSelector extends Selector {
	constructor(before, after) {
		super();
		this.before = before;
		this.after = after;
	}
	findMatches(dom, recursive, matchSet) {
		const beforeMatches = new Set;
		this.before.findMatches(dom, recursive, beforeMatches);
		for (const beforeMatch of beforeMatches) {
			const siblings = beforeMatch.parent.children;
			const next = siblings[siblings.indexOf(beforeMatch) + 1];
			if (next === undefined) continue;
			this.after.findMatches([next], false, matchSet);
		}
	}
}
class AfterSelector extends Selector {
	constructor(before, after) {
		super();
		this.before = before;
		this.after = after;
	}
	findMatches(dom, recursive, matchSet) {
		const beforeMatches = new Set;
		this.before.findMatches(dom, recursive, beforeMatches);
		for (const beforeMatch of beforeMatches) {
			const siblings = beforeMatch.parent.children;
			const afterSiblings = siblings.slice(siblings.indexOf(beforeMatch) + 1);
			this.after.findMatches(afterSiblings, false, matchSet);
		}
	}
}
function makeSelector(string) {
	for (let i = 1; i + 1 < string.length; i++) {
		if (string[i] === ' ' && (isSeparator(string[i - 1]) || isSeparator(string[i + 1]))) {
			string = string.substring(0, i) + string.substring(i + 1);
			i--;
		}
	}
	const selectors = [];
	for (const selectorString of string.split(',')) {
		let selectorStart = 0;
		const selectorPieces = [];
		let insideBrackets = 0, insideQuotes = false;
		for (let i = 0; i < selectorString.length; i++) {
			const char = selectorString[i];
			if (isSeparator(char) && !insideBrackets && !insideQuotes) {
				selectorPieces.push({
					selector: new SingleSelector(selectorString.substring(selectorStart, i)),
					separator: char
				});
				selectorStart = i + 1;
			}
			else if (selectorString[i] === '\\') i++;
			else if (char === '"') insideQuotes = !insideQuotes;
			else if (!insideQuotes) {
				if (char === '[') insideBrackets++;
				else if (char === ']') insideBrackets--;
			}
		}
		let selector = new SingleSelector(selectorString.substring(selectorStart));
		for (let i = selectorPieces.length - 1; i > -1; i--) { //build selector from right to left
			const selectorPiece = selectorPieces[i];
			switch (selectorPiece.separator) {
				case ' ':
					selector = new DescendantSelector(selectorPiece.selector, selector);
					break;
				case '>':
					selector = new DirectDescendantSelector(selectorPiece.selector, selector);
					break;
				case '+':
					selector = new AdjacentSelector(selectorPiece.selector, selector);
					break;
				case '~':
					selector = new AfterSelector(selectorPiece.selector, selector);
			}
		}
		selectors.push(selector);
	}
	return new CommaSelector(selectors);
}

module.exports = (dom, selectorString) => {
	if (!(dom instanceof Array)) dom = [dom];
	const selector = makeSelector(selectorString);
	const matches = new Set;
	selector.findMatches(dom, true, matches);
	return matches;
};