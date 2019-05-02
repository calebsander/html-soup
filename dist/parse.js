"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const html_decode_1 = require("./html-decode");
const DATASET_ATTR_PREFIX = 'data-';
class TextNode {
    constructor(text) {
        this.text = text;
    }
}
exports.TextNode = TextNode;
class HtmlTag {
    constructor({ type, attributes, children, parent }) {
        this.type = type;
        this.attributes = attributes;
        if (children)
            this.children = children;
        this.parent = parent;
    }
    setChildren(children) {
        this.children = children;
    }
    get child() {
        return this.children[0];
    }
    get classes() {
        if (!this.classSet) {
            this.classSet = typeof this.attributes.class === 'string'
                ? new Set(this.attributes.class.split(' '))
                : new Set;
        }
        return this.classSet;
    }
    get dataset() {
        const dataset = {};
        for (const attribute in this.attributes) {
            if (!attribute.startsWith(DATASET_ATTR_PREFIX))
                continue;
            const value = this.attributes[attribute];
            if (value === undefined)
                continue;
            const dataName = attribute.slice(DATASET_ATTR_PREFIX.length)
                .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            dataset[dataName] = typeof value === 'string' ? value : '';
        }
        return dataset;
    }
}
exports.HtmlTag = HtmlTag;
class ReadingState {
    constructor(ignoreWhitespace) {
        this.ignoreWhitespace = ignoreWhitespace;
    }
}
const READING_TEXT = new ReadingState(false), READING_ESCAPE = new ReadingState(false), IN_TAG = new ReadingState(false), READING_ATTRIBUTE_NAME = new ReadingState(true), LOOKING_FOR_VALUE_START = new ReadingState(true), READING_ATTRIBUTE_VALUE = new ReadingState(false), READING_ESCAPE_ATTRIBUTE = new ReadingState(false);
const WHITESPACE = /^\s$/;
const SINGLETON_TAGS = new Set([
    'area',
    'base',
    'br',
    'col',
    'command',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source'
]);
/*
    A tree structure used to contain all the valid non-numeric ampersand codes.
    Each level of the tree contains a mapping of characters to sub-trees.
    If the path through the tree is a valid complete code (as opposed to just the start of one),
    then '' will be in the map.

    Example containing the codes 'abc', 'abcd', and 'def'
       root
      /    \
     'a'  'd'
      |    |
     'b'  'e'
      |    |
     'c'  'f'
     / \    \
    '' 'd'  ''
        |
       ''
*/
class TextTree {
    constructor() {
        this.children = new Map();
    }
    //Inserts the specified string into the tree,
    //including all necessary sub-trees
    insertWord(word) {
        const firstLetter = word.slice(0, 1); //can be '' if word is empty
        let child = this.children.get(firstLetter);
        if (!child) {
            child = new TextTree;
            this.children.set(firstLetter, child);
        }
        if (word)
            child.insertWord(word.substring(1));
    }
    getChild(letter) {
        return this.children.get(letter);
    }
}
const AMPERSAND_TEXT_CODES = new TextTree;
for (const escapeCode in html_decode_1.default)
    AMPERSAND_TEXT_CODES.insertWord(escapeCode);
const AMPERSAND_CODE_CHAR = /^[#\d]$/;
//Returns whether the ampersand code starting at index in string
//should be treated as an escape sequence or just normal text
function validAmpersandCode(string, index) {
    if (AMPERSAND_CODE_CHAR.test(string[index]))
        return true; //if it starts "&1" or "&#", it must start an escape sequence
    //Iterate down levels of the escape code tree and indices in the string
    //If tree is ever undefined, we know no codes start with this sequence
    for (let tree = AMPERSAND_TEXT_CODES; tree; tree = tree.getChild(string[index++])) {
        if (string[index] === ';')
            return !!tree.getChild(''); //make sure this a valid complete code, not just the start to one
    }
    return false;
}
//Returns whether matchString occurs starting at string[index]
function followedBy(string, index, matchString) {
    const { length } = matchString;
    return string.substring(index, index + length) === matchString;
}
const HTML_COMMENT_START = '<!--';
const HTML_COMMENT_END = '-->';
function readChildren(string, index, parent, trimText) {
    const inScript = parent && parent.type === 'script';
    const originalIndex = index;
    const children = [];
    let state = READING_TEXT, inComment = false, text = '', name, attributeName, value, closingTag, attributes, escapeCode, selfClosing, valueEndCharacter;
    for (; state; index++) {
        if (index >= string.length)
            break;
        const char = string[index];
        const whitespace = WHITESPACE.test(char);
        if (state.ignoreWhitespace && whitespace)
            continue;
        switch (state) {
            case READING_TEXT:
                if (char === '<' && (!inScript || (inScript && followedBy(string, index, '</script>'))) && !inComment) {
                    if (followedBy(string, index, HTML_COMMENT_START)) {
                        text += HTML_COMMENT_START;
                        inComment = true;
                        index += HTML_COMMENT_START.length - 1;
                    }
                    else {
                        if (trimText)
                            text = text.trim();
                        if (text)
                            children.push(new TextNode(text));
                        state = IN_TAG;
                        name = '';
                        closingTag = false;
                        attributes = {};
                        selfClosing = false;
                    }
                }
                else if (char === '&' && !inScript && validAmpersandCode(string, index + 1)) {
                    state = READING_ESCAPE;
                    escapeCode = '';
                }
                else if (inComment && followedBy(string, index, HTML_COMMENT_END)) {
                    text += HTML_COMMENT_END;
                    inComment = false;
                    index += HTML_COMMENT_END.length - 1;
                }
                else
                    text += char;
                break;
            case READING_ESCAPE:
            case READING_ESCAPE_ATTRIBUTE:
                if (char === ';') {
                    let resolvedChar;
                    if (escapeCode[0] === '#') {
                        resolvedChar = String.fromCharCode(Number(escapeCode.substring(1)));
                    }
                    else {
                        resolvedChar = html_decode_1.default[escapeCode];
                        if (resolvedChar === undefined)
                            throw new Error("Couldn't decode &" + escapeCode + ';');
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
                else
                    escapeCode += char;
                break;
            case IN_TAG:
                if (whitespace) {
                    if (name) {
                        state = READING_ATTRIBUTE_NAME;
                        attributeName = '';
                    }
                }
                else if (char === '/') {
                    if (name)
                        selfClosing = true;
                    else
                        closingTag = true;
                }
                else if (char === '>') {
                    if (closingTag)
                        state = null; //we have come to the end of all that had to be read
                    else {
                        if (SINGLETON_TAGS.has(name.toLowerCase()))
                            selfClosing = true;
                        if (selfClosing) {
                            children.push(new HtmlTag({
                                type: name,
                                attributes: attributes,
                                children: [],
                                parent
                            }));
                        }
                        else {
                            const tag = new HtmlTag({ type: name, attributes: attributes, parent });
                            const { children: subChildren, length } = readChildren(string, index + 1, tag, trimText);
                            tag.setChildren(subChildren);
                            children.push(tag);
                            index += length;
                        }
                        text = '';
                        state = READING_TEXT;
                    }
                }
                else {
                    if (!closingTag)
                        name += char; //name is not necessary for a closing tag
                }
                break;
            case READING_ATTRIBUTE_NAME:
                const tagChar = char === '/' || char === '>';
                if (char === '=')
                    state = LOOKING_FOR_VALUE_START;
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
                if (char === "'" || char === '"')
                    valueEndCharacter = char;
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
                    if (char === '&' && validAmpersandCode(string, index + 1)) {
                        state = READING_ESCAPE_ATTRIBUTE;
                        escapeCode = '';
                    }
                    else
                        value += char;
                }
                break;
            default:
                throw new Error('Invalid state');
        }
    }
    if (state === READING_TEXT) {
        if (trimText)
            text = text.trim();
        if (text)
            children.push(new TextNode(text));
    }
    return { children, length: index - originalIndex };
}
function parse(str, trimText = true) {
    //Assumes a correctly formatted HTML string
    if (str && str instanceof Buffer)
        str = str.toString();
    const root = new HtmlTag({ type: '', attributes: {}, parent: null });
    const { children } = readChildren(str, 0, root, trimText);
    root.setChildren(children);
    return children.length === 1 ? children[0] : children;
}
exports.default = Object.assign(parse, { HtmlTag, TextNode });
